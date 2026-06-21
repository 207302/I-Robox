import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { readJsonBody } from "@/lib/validation/input";
import { validateOtpCode, validatePassword, validateUuid } from "@/lib/validation/rules";
import { linkRecoveryEmailAfterOtp } from "@/lib/auth/linkRecoveryEmailAfterOtp";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`reset-password:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const userIdResult = validateUuid(body.userId, "user");
    const otpResult = validateOtpCode(body.otp);
    const passwordResult = validatePassword(body.newPassword);
    if (!userIdResult.ok) {
      return NextResponse.json({ error: userIdResult.error }, { status: 400 });
    }
    if (!otpResult.ok) {
      return NextResponse.json({ error: otpResult.error }, { status: 400 });
    }
    if (!passwordResult.ok) {
      return NextResponse.json({ error: passwordResult.error }, { status: 400 });
    }
    const userId = userIdResult.value;
    const otp = otpResult.value;
    const newPassword = passwordResult.value;
  
    const otpRecord = await prisma.signup_email_otps.findFirst({
      where: { customer_id: userId, used_at: null },
      orderBy: { created_at: "desc" },
      select: { id: true, code_hash: true, expires_at: true, attempts: true },
    });
    if (!otpRecord) return NextResponse.json({ error: "OTP not found" }, { status: 400 });
    if (otpRecord.expires_at <= new Date()) {
      return NextResponse.json({ error: "OTP expired" }, { status: 400 });
    }
    if (otpRecord.attempts >= 5) {
      return NextResponse.json({ error: "OTP attempts exceeded" }, { status: 429 });
    }
  
    const ok = await bcrypt.compare(otp, otpRecord.code_hash);
    if (!ok) {
      await prisma.signup_email_otps.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }
  
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.customers.update({
        where: { id: userId },
        data: { password_hash: passwordHash, is_active: true },
      });
      await tx.signup_email_otps.update({
        where: { id: otpRecord.id },
        data: { used_at: new Date() },
      });
    });

    await linkRecoveryEmailAfterOtp(userId, otpRecord.id);

    return NextResponse.json({ ok: true });
  
  });}
