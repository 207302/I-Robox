import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth/jwt";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { getAuthSecret, getSession, setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import { cleanText, hasSuspiciousInput, normalizeEmail, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function PUT(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_profile_put:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
        1
      );
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      await rateLimitStorefront(`account_profile_put:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const current = await prisma.customers.findUnique({
      where: { id: session.sub },
      select: { name: true, email: true, google_sub: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const data: { name?: string; email?: string } = {};
    let emailChanged = false;

    if (parsed.body.name !== undefined) {
      const name = cleanText(parsed.body.name, 150);
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      if (hasSuspiciousInput(name)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }
      data.name = name;
    }

    if (parsed.body.email !== undefined) {
      if (current.google_sub) {
        return NextResponse.json(
          { error: "Email is managed by your Google account and cannot be changed here." },
          { status: 400 }
        );
      }

      const email = normalizeEmail(parsed.body.email);
      if (!email || !validateEmail(email)) {
        return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
      }
      if (!validateCommonEmailProvider(email)) {
        return NextResponse.json(
          { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
          { status: 400 }
        );
      }
      if (hasSuspiciousInput(email)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }

      const currentNorm = current.email.trim().toLowerCase();
      if (email !== currentNorm) {
        const taken = await prisma.customers.findFirst({
          where: { email, NOT: { id: session.sub } },
          select: { id: true },
        });
        if (taken) {
          return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
        }
        data.email = email;
        emailChanged = true;
      }
    }

    if (!data.name && !data.email) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.customers.update({
      where: { id: session.sub },
      data,
      select: { name: true, email: true },
    });

    if (emailChanged && data.email) {
      const token = signJwt(
        { sub: session.sub, email: data.email, roles: session.roles },
        getAuthSecret(),
        SESSION_TTL_SECONDS
      );
      await setSessionCookie(token, SESSION_TTL_SECONDS);
    }

    const displayEmail =
      updated.email && !isSyntheticPhoneSignupEmail(updated.email) ? updated.email : null;

    return NextResponse.json({
      ok: true,
      name: updated.name,
      email: displayEmail,
    });
  });
}
