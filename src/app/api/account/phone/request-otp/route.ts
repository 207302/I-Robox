import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findCustomerPhoneConflict,
  phoneConflictErrorMessage,
  phoneLookupVariants,
} from "@/lib/auth/phoneAccount";
import {
  createPhoneChangeOtp,
  resolvePhoneChangeOtpEmail,
} from "@/lib/auth/phoneChangeOtp";
import {
  indianMobileErrorMessage,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/lib/auth/indianMobile";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { cleanText, hasSuspiciousInput, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_phone_otp:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
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
      await rateLimitStorefront(`account_phone_otp:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const rawPhone = cleanText(parsed.body.phone, 30);
    if (!rawPhone) {
      return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });
    }
    if (hasSuspiciousInput(rawPhone)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (!isValidIndianMobile(rawPhone)) {
      return NextResponse.json({ error: indianMobileErrorMessage() }, { status: 400 });
    }

    const newPhone = normalizeIndianMobileDigits(rawPhone);
    if (!newPhone) {
      return NextResponse.json({ error: indianMobileErrorMessage() }, { status: 400 });
    }

    const current = await prisma.customers.findUnique({
      where: { id: session.sub },
      select: { phone: true, email: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const currentVariants = current.phone ? phoneLookupVariants(current.phone) : [];
    if (currentVariants.includes(newPhone) || current.phone === newPhone) {
      return NextResponse.json({ error: "This is already your mobile number" }, { status: 400 });
    }

    const conflict = await findCustomerPhoneConflict(newPhone, session.sub);
    if (conflict) {
      return NextResponse.json({ error: phoneConflictErrorMessage() }, { status: 409 });
    }

    const otpEmail = resolvePhoneChangeOtpEmail(current.email);
    if (!otpEmail) {
      return NextResponse.json(
        {
          error: "Add a Gmail address to your profile before changing your mobile number.",
          needsEmail: true,
        },
        { status: 400 }
      );
    }

    const { emailSent, devOtp } = await createPhoneChangeOtp({
      customerId: session.sub,
      newPhone,
      email: otpEmail,
    });

    return NextResponse.json({
      ok: true,
      sentTo: otpEmail,
      emailSent,
      ...(devOtp ? { devOtp } : {}),
    });
  });
}
