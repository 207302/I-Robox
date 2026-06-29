import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { normalizeEmail } from "@/lib/validation/input";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function canExposeEmailChangeOtpForDebug() {
  return process.env.NODE_ENV !== "production" || process.env.OTP_DEBUG_EXPOSE === "true";
}

/** Real inbox on file today — OTP is always sent here, never to the new address. */
export function resolveEmailChangeOtpDestination(email: string): string | null {
  if (isSyntheticPhoneSignupEmail(email)) return null;
  return displayEmailForCustomer(email);
}

export async function invalidatePendingEmailChangeOtps(customerId: string) {
  await prisma.email_change_otps.updateMany({
    where: { customer_id: customerId, used_at: null },
    data: { used_at: new Date() },
  });
}

export async function createEmailChangeOtp(params: {
  customerId: string;
  newEmail: string;
  oldEmail: string;
}) {
  const otpCode = generateOtpCode();
  const otpCodeHash = await bcrypt.hash(otpCode, 12);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await invalidatePendingEmailChangeOtps(params.customerId);

  await prisma.email_change_otps.create({
    data: {
      customer_id: params.customerId,
      new_email: params.newEmail,
      old_email: params.oldEmail,
      code_hash: otpCodeHash,
      expires_at: expiresAt,
    },
  });

  const emailResult = await sendEmail({
    to: params.oldEmail,
    subject: "Confirm your email address change",
    html: `
      <div style="font-family:${EMAIL_FONT_FAMILY};line-height:1.5">
        <h2>Email change verification</h2>
        <p>You requested to change the email on your i-Robox account to <strong>${params.newEmail}</strong>.</p>
        <p>Your OTP code is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p>
        <p>This code was sent to your current email for security. It expires in 10 minutes.</p>
        <p>If you did not request this change, you can ignore this email.</p>
      </div>
    `,
  }).catch(() => ({ ok: false, skipped: true }));

  return {
    emailSent: !emailResult?.skipped,
    sentTo: params.oldEmail,
    devOtp: canExposeEmailChangeOtpForDebug() && emailResult?.skipped ? otpCode : undefined,
  };
}

export async function verifyEmailChangeOtp(params: {
  customerId: string;
  newEmail: string;
  otp: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const normalizedNew = normalizeEmail(params.newEmail);
  const otpRecord = await prisma.email_change_otps.findFirst({
    where: {
      customer_id: params.customerId,
      new_email: normalizedNew,
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
    await prisma.email_change_otps.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Invalid OTP", status: 400 };
  }

  await prisma.email_change_otps.update({
    where: { id: otpRecord.id },
    data: { used_at: new Date() },
  });

  return { ok: true };
}
