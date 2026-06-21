import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { hashPasswordSetupToken } from "@/lib/auth/passwordSetupToken";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanText, readJsonBody } from "@/lib/validation/input";
import { validatePassword } from "@/lib/validation/rules";
import { runApiRoute } from "@/lib/api/runApiRoute";

const MAX_TOKEN_LEN = 128;

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`set-password-token:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const token = typeof body.token === "string" ? cleanText(body.token, MAX_TOKEN_LEN) : "";
    const passwordResult = validatePassword(body.newPassword);

    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 400 });
    }
    if (!passwordResult.ok) {
      return NextResponse.json({ error: passwordResult.error }, { status: 400 });
    }
    const newPassword = passwordResult.value;
  
    const token_hash = hashPasswordSetupToken(token);
  
    const row = await prisma.customer_password_setup_tokens.findFirst({
      where: { token_hash, used_at: null },
      select: { id: true, customer_id: true, expires_at: true },
    });
  
    if (!row) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }
    if (row.expires_at <= new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 400 });
    }
  
    const password_hash = await bcrypt.hash(newPassword, 12);
  
    await prisma.$transaction(async (tx) => {
      await tx.customers.update({
        where: { id: row.customer_id },
        data: { password_hash, is_active: true },
      });
      await tx.customer_password_setup_tokens.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      });
      await tx.customer_password_setup_tokens.updateMany({
        where: { customer_id: row.customer_id, used_at: null, id: { not: row.id } },
        data: { used_at: new Date() },
      });
    });
  
    return NextResponse.json({ ok: true });
  
  });}
