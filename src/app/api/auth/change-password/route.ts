import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanText, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`change-password:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const otp = cleanText(body.otp, 10);
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!otp || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
  
    const otpRecord = await prisma.signup_email_otps.findFirst({
      where: { customer_id: session.sub, used_at: null },
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
        where: { id: session.sub },
        data: { password_hash: passwordHash, is_active: true },
      });
      await tx.signup_email_otps.update({
        where: { id: otpRecord.id },
        data: { used_at: new Date() },
      });
    });
  
    return NextResponse.json({ ok: true });
  
  });}
