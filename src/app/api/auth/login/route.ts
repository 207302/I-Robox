import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth/jwt";
import { getAuthSecret, setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import { cleanText, normalizePhone, readJsonBody, hasSuspiciousInput } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`login:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const identifier =
      typeof body.identifier === "string"
        ? cleanText(body.identifier, 320)
        : typeof body.email === "string"
        ? cleanText(body.email, 320)
        : "";
    const password = typeof body.password === "string" ? body.password : "";
  
    if (!identifier || !password) {
      return NextResponse.json({ error: "Email/phone and password are required" }, { status: 400 });
    }
    const normalizedIdentifier = identifier.toLowerCase();
    const looksLikeEmail = validateEmail(normalizedIdentifier);
    const normalizedPhone = normalizePhone(identifier);
    if (hasSuspiciousInput(identifier)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (identifier.includes("@") && !looksLikeEmail) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (looksLikeEmail && !validateCommonEmailProvider(normalizedIdentifier)) {
      return NextResponse.json(
        { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
        { status: 400 }
      );
    }
  
    const user = await prisma.customers.findFirst({
      where: looksLikeEmail
        ? { email: normalizedIdentifier }
        : { phone: normalizedPhone },
      select: {
        id: true,
        email: true,
        phone: true,
        password_hash: true,
        is_active: true,
      },
    });
  
    if (!user) {
      return NextResponse.json(
        {
          error: "Account not found. Please create your account.",
          redirectToSignup: true,
          suggestedIdentifier: identifier,
        },
        { status: 404 }
      );
    }
  
    if (!user.is_active) {
      return NextResponse.json(
        { error: "Please verify your email with OTP before signing in." },
        { status: 403 }
      );
    }
  
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
  
    const token = signJwt(
      { sub: user.id, email: user.email, roles: [] },
      getAuthSecret(),
      SESSION_TTL_SECONDS
    );
  
    await setSessionCookie(token, SESSION_TTL_SECONDS);
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

