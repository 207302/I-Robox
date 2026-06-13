import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function canExposePhoneChangeOtpForDebug() {
  return process.env.NODE_ENV !== "production" || process.env.OTP_DEBUG_EXPOSE === "true";
}

export function resolvePhoneChangeOtpEmail(email: string): string | null {
  if (isSyntheticPhoneSignupEmail(email)) return null;
  return displayEmailForCustomer(email);
}

export async function invalidatePendingPhoneChangeOtps(customerId: string) {
  await prisma.phone_change_otps.updateMany({
    where: { customer_id: customerId, used_at: null },
    data: { used_at: new Date() },
  });
}

export async function createPhoneChangeOtp(params: {
  customerId: string;
  newPhone: string;
  email: string;
}) {
  const otpCode = generateOtpCode();
  const otpCodeHash = await bcrypt.hash(otpCode, 12);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await invalidatePendingPhoneChangeOtps(params.customerId);

  await prisma.phone_change_otps.create({
    data: {
      customer_id: params.customerId,
      new_phone: params.newPhone,
      email: params.email,
      code_hash: otpCodeHash,
      expires_at: expiresAt,
    },
  });

  const emailResult = await sendEmail({
    to: params.email,
    subject: "Confirm your mobile number change",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5">
        <h2>Mobile number change verification</h2>
        <p>You requested to update the mobile number on your i-Robox account to <strong>${params.newPhone}</strong>.</p>
        <p>Your OTP code is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p>
        <p>This code expires in 10 minutes. If you did not request this change, you can ignore this email.</p>
      </div>
    `,
  }).catch(() => ({ ok: false, skipped: true }));

  return {
    emailSent: !emailResult?.skipped,
    devOtp: canExposePhoneChangeOtpForDebug() && emailResult?.skipped ? otpCode : undefined,
  };
}

export async function verifyPhoneChangeOtp(params: {
  customerId: string;
  newPhone: string;
  otp: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const otpRecord = await prisma.phone_change_otps.findFirst({
    where: {
      customer_id: params.customerId,
      new_phone: params.newPhone,
      used_at: null,
    },
    orderBy: { created_at: "desc" },
    select: { id: true, code_hash: true, expires_at: true, attempts: true },
  });

  if (!otpRecord) {
    return { ok: false, error: "OTP not found. Request a new code.", status: 400 };
  }
  if (otpRecord.expires_at <= new Date()) {
    return { ok: false, error: "OTP expired. Request a new code.", status: 400 };
  }
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "OTP attempts exceeded. Request a new code.", status: 429 };
  }

  const otpOk = await bcrypt.compare(params.otp, otpRecord.code_hash);
  if (!otpOk) {
    await prisma.phone_change_otps.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Invalid OTP", status: 400 };
  }

  await prisma.phone_change_otps.update({
    where: { id: otpRecord.id },
    data: { used_at: new Date() },
  });

  return { ok: true };
}
