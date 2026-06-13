import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createEmailChangeOtp,
  resolveEmailChangeOtpDestination,
} from "@/lib/auth/emailChangeOtp";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import { cleanText, hasSuspiciousInput, normalizeEmail, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_email_otp:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
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
      await rateLimitStorefront(`account_email_otp:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const newEmail = normalizeEmail(parsed.body.email);
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
      return NextResponse.json({ error: "This is already your email address" }, { status: 400 });
    }

    const oldEmail = resolveEmailChangeOtpDestination(current.email);
    if (!oldEmail) {
      return NextResponse.json(
        {
          error: "Add your first email without OTP from the profile form, then use OTP for future changes.",
          needsInitialEmail: true,
        },
        { status: 400 }
      );
    }

    const taken = await prisma.customers.findFirst({
      where: { email: newEmail, NOT: { id: session.sub } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
    }

    const { emailSent, sentTo, devOtp } = await createEmailChangeOtp({
      customerId: session.sub,
      newEmail,
      oldEmail,
    });

    return NextResponse.json({
      ok: true,
      sentTo,
      emailSent,
      ...(devOtp ? { devOtp } : {}),
    });
  });
}
