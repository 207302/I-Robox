import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import { getSession } from "@/lib/auth/session";
import {
  cleanText,
  isUuid,
  normalizeEmail,
  normalizePhone,
  readJsonBody,
  hasSuspiciousInput,
} from "@/lib/validation/input";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { runApiRoute } from "@/lib/api/runApiRoute";

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function canExposeOtpForDebug() {
  return process.env.NODE_ENV !== "production" || process.env.OTP_DEBUG_EXPOSE === "true";
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`request-password-otp:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const identifier = cleanText(body.identifier, 320);
    const recoveryEmailRaw = cleanText(body.recoveryEmail, 320);
    const requestedUserId = typeof body.userId === "string" ? body.userId : "";
    const session = await getSession();
  
    const normalizedIdentifier = identifier.toLowerCase();
    const byEmail = validateEmail(normalizedIdentifier);
    const byPhone = normalizePhone(identifier);
    if (identifier && hasSuspiciousInput(identifier)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (requestedUserId && !isUuid(requestedUserId)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (byEmail && !validateCommonEmailProvider(normalizedIdentifier)) {
      return NextResponse.json(
        { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
        { status: 400 }
      );
    }
  
    const user = requestedUserId
      ? await prisma.customers.findUnique({
          where: { id: requestedUserId },
          select: { id: true, email: true, is_active: true },
        })
      : await prisma.customers.findFirst({
          where: byEmail ? { email: normalizedIdentifier } : { phone: byPhone },
          select: { id: true, email: true, is_active: true },
        });
  
    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (requestedUserId && session?.sub && session.sub !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const phoneOnlyAccount = isSyntheticPhoneSignupEmail(user.email);
    const linkedEmail = normalizeEmail(user.email);
    const resetStartedWithPhone = !requestedUserId && !byEmail && Boolean(byPhone);
    let otpDeliveryEmail = linkedEmail;

    if (!phoneOnlyAccount) {
      if (resetStartedWithPhone || recoveryEmailRaw) {
        if (!recoveryEmailRaw) {
          return NextResponse.json(
            {
              error: "Enter the Gmail address linked to this mobile number to receive your OTP.",
              needsRecoveryEmail: true,
              userId: user.id,
            },
            { status: 400 }
          );
        }
        const normalizedRecoveryEmail = normalizeEmail(recoveryEmailRaw);
        if (!validateEmail(normalizedRecoveryEmail)) {
          return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
        }
        if (!validateCommonEmailProvider(normalizedRecoveryEmail)) {
          return NextResponse.json(
            { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
            { status: 400 }
          );
        }
        if (normalizedRecoveryEmail !== linkedEmail) {
          return NextResponse.json(
            { error: "This mobile number is linked to another Gmail account." },
            { status: 400 }
          );
        }
        otpDeliveryEmail = normalizedRecoveryEmail;
      }
    } else if (phoneOnlyAccount) {
      if (!recoveryEmailRaw) {
        return NextResponse.json(
          {
            error: "This account has no email on file. Enter a Gmail address to receive your OTP.",
            needsRecoveryEmail: true,
            userId: user.id,
          },
          { status: 400 }
        );
      }
      const normalizedRecoveryEmail = normalizeEmail(recoveryEmailRaw);
      if (!validateEmail(normalizedRecoveryEmail)) {
        return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
      }
      if (!validateCommonEmailProvider(normalizedRecoveryEmail)) {
        return NextResponse.json(
          { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
          { status: 400 }
        );
      }
      const emailTaken = await prisma.customers.findFirst({
        where: { email: normalizedRecoveryEmail, NOT: { id: user.id } },
        select: { id: true },
      });
      if (emailTaken) {
        return NextResponse.json(
          { error: "That email is already linked to another account" },
          { status: 409 }
        );
      }
      otpDeliveryEmail = normalizedRecoveryEmail;
    }

    const otpCode = generateOtpCode();
    const otpCodeHash = await bcrypt.hash(otpCode, 12);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
    await prisma.signup_email_otps.create({
      data: {
        customer_id: user.id,
        email: otpDeliveryEmail,
        code_hash: otpCodeHash,
        expires_at: otpExpiresAt,
      },
    });

    const emailResult = await sendEmail({
      to: otpDeliveryEmail,
      subject: "Your password reset OTP code",
      html: `
        <div style="font-family:${EMAIL_FONT_FAMILY};line-height:1.5">
          <h2>Password reset verification</h2>
          <p>Your OTP code is:</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    }).catch(() => ({ ok: false, skipped: true }));
  
    return NextResponse.json({
      ok: true,
      userId: user.id,
      emailSent: !emailResult?.skipped,
      sentTo: otpDeliveryEmail,
      ...(canExposeOtpForDebug() && emailResult?.skipped ? { devOtp: otpCode } : {}),
    });
  
  });}
