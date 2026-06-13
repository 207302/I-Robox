import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth/jwt";
import { verifyEmailChangeOtp } from "@/lib/auth/emailChangeOtp";
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
        `account_email_put:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
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
      await rateLimitStorefront(`account_email_put:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const newEmail = normalizeEmail(parsed.body.email);
    const otp = cleanText(parsed.body.otp, 10);

    if (!newEmail || !validateEmail(newEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (!validateCommonEmailProvider(newEmail)) {
      return NextResponse.json(
        { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
        { status: 400 }
      );
    }
    if (hasSuspiciousInput(newEmail)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const current = await prisma.customers.findUnique({
      where: { id: session.sub },
      select: { email: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const currentNorm = current.email.trim().toLowerCase();
    if (newEmail === currentNorm) {
      const displayEmail =
        current.email && !isSyntheticPhoneSignupEmail(current.email) ? current.email : null;
      return NextResponse.json({ ok: true, email: displayEmail });
    }

    const taken = await prisma.customers.findFirst({
      where: { email: newEmail, NOT: { id: session.sub } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
    }

    const hasRealCurrentEmail = !isSyntheticPhoneSignupEmail(current.email);
    if (hasRealCurrentEmail) {
      if (!otp || !/^\d{6}$/.test(otp)) {
        return NextResponse.json(
          { error: "Enter the 6-digit OTP sent to your current email" },
          { status: 400 }
        );
      }

      const verified = await verifyEmailChangeOtp({
        customerId: session.sub,
        newEmail,
        otp,
      });
      if (!verified.ok) {
        return NextResponse.json({ error: verified.error }, { status: verified.status });
      }
    }

    const updated = await prisma.customers.update({
      where: { id: session.sub },
      data: { email: newEmail },
      select: { email: true },
    });

    const token = signJwt(
      { sub: session.sub, email: newEmail, roles: session.roles },
      getAuthSecret(),
      SESSION_TTL_SECONDS
    );
    await setSessionCookie(token, SESSION_TTL_SECONDS);

    const displayEmail =
      updated.email && !isSyntheticPhoneSignupEmail(updated.email) ? updated.email : null;

    return NextResponse.json({
      ok: true,
      email: displayEmail,
    });
  });
}
