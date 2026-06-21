import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth/jwt";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { sendEmail } from "@/lib/email";
import { getAuthSecret, setSessionCookie } from "@/lib/auth/session";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import {
  cleanText,
  normalizeEmail,
  normalizePhone,
  readJsonBody,
  hasSuspiciousInput,
} from "@/lib/validation/input";
import { syntheticEmailForPhone } from "@/lib/auth/signupIdentifier";
import { validatePassword } from "@/lib/validation/rules";
import { runApiRoute } from "@/lib/api/runApiRoute";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function canExposeOtpForDebug() {
  return process.env.NODE_ENV !== "production" || process.env.OTP_DEBUG_EXPOSE === "true";
}

function isValidPhoneDigits(normalizedPhone: string) {
  return /^\+?[0-9]{7,15}$/.test(normalizedPhone.replace(/\s+/g, ""));
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`signup:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const name = cleanText(body.name, 150);
    const identifier =
      typeof body.identifier === "string"
        ? cleanText(body.identifier, 320)
        : typeof body.email === "string"
        ? cleanText(body.email, 320)
        : "";
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.ok) {
      return NextResponse.json({ error: passwordResult.error }, { status: 400 });
    }
    const password = passwordResult.value;
    if (!identifier) {
      return NextResponse.json({ error: "Email or phone and password are required" }, { status: 400 });
    }
    if (hasSuspiciousInput(identifier) || hasSuspiciousInput(name)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
  
    const normalizedIdentifier = identifier.toLowerCase();
    const looksLikeEmail = validateEmail(normalizedIdentifier);
    const normalizedPhone = normalizePhone(identifier);
  
    if (identifier.includes("@") && !looksLikeEmail) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
  
    let email: string;
    let phone: string | null = null;
    let signupWithPhone = false;
  
    if (looksLikeEmail) {
      email = normalizeEmail(identifier);
      if (!validateCommonEmailProvider(email)) {
        return NextResponse.json(
          { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
          { status: 400 }
        );
      }
    } else {
      phone = normalizedPhone;
      if (!phone || !isValidPhoneDigits(phone)) {
        return NextResponse.json(
          { error: "Please enter a valid email or mobile number" },
          { status: 400 }
        );
      }
      if (hasSuspiciousInput(phone)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }
      const digitsOnly = phone.replace(/\D/g, "");
      email = syntheticEmailForPhone(digitsOnly);
      signupWithPhone = true;
    }

    const existing = await prisma.customers.findFirst({
      where: signupWithPhone ? { OR: [{ phone: phone! }, { email }] } : { email },
    });
  
    if (existing) {
      if (signupWithPhone && existing.phone && phone && existing.phone === phone) {
        return NextResponse.json({ error: "Mobile number is already registered" }, { status: 409 });
      }
      if (!signupWithPhone && existing.is_active) {
        return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
      }
      if (signupWithPhone && existing.is_active) {
        return NextResponse.json({ error: "This number is already registered" }, { status: 409 });
      }
  
      // Email path, existing but unverified: resend OTP
      if (!signupWithPhone && !existing.is_active) {
        const otpCode = generateOtpCode();
        const otpCodeHash = await bcrypt.hash(otpCode, 12);
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
        await prisma.signup_email_otps.create({
          data: {
            customer_id: existing.id,
            email,
            code_hash: otpCodeHash,
            expires_at: otpExpiresAt,
          },
        });
  
        const emailResult = await sendEmail({
          to: existing.email,
          subject: "Your i-Robox OTP verification code",
          html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5">
            <h2>Verify your email</h2>
            <p>Your OTP code is:</p>
            <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p>
            <p>This code expires in 10 minutes.</p>
          </div>
        `,
        }).catch(() => ({ ok: false, skipped: true }));
  
        return NextResponse.json(
          {
            ok: true,
            requiresOtp: true,
            userId: existing.id,
            emailSent: !emailResult?.skipped,
            ...(canExposeOtpForDebug() && emailResult?.skipped ? { devOtp: otpCode } : {}),
          },
          { status: 200 }
        );
      }
  
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }
  
    const passwordHash = await bcrypt.hash(password, 12);
  
    if (signupWithPhone) {
      const created = await prisma.customers.create({
        data: {
          email,
          password_hash: passwordHash,
          name: name || null,
          phone,
          is_active: true,
        },
        select: { id: true, email: true },
      });
  
      const token = signJwt(
        { sub: created.id, email: created.email, roles: [] },
        getAuthSecret(),
        SESSION_TTL_SECONDS
      );
      await setSessionCookie(token, SESSION_TTL_SECONDS);
  
      return NextResponse.json(
        { ok: true, requiresOtp: false, userId: created.id },
        { status: 201 }
      );
    }
  
    const otpCode = generateOtpCode();
    const otpCodeHash = await bcrypt.hash(otpCode, 12);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.customers.create({
        data: {
          email,
          password_hash: passwordHash,
          name: name || null,
          phone: null,
          is_active: false,
        },
        select: { id: true, email: true },
      });
  
      await tx.signup_email_otps.create({
        data: {
          customer_id: created.id,
          email,
          code_hash: otpCodeHash,
          expires_at: otpExpiresAt,
        },
      });
  
      return created;
    });
  
    const emailResult = await sendEmail({
      to: user.email,
      subject: "Your i-Robox OTP verification code",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5">
          <h2>Verify your email</h2>
          <p>Your OTP code is:</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    }).catch(() => ({ ok: false, skipped: true }));
  
    return NextResponse.json({
      ok: true,
      requiresOtp: true,
      userId: user.id,
      emailSent: !emailResult?.skipped,
      ...(canExposeOtpForDebug() && emailResult?.skipped ? { devOtp: otpCode } : {}),
    }, { status: 201 });
  
  });}
