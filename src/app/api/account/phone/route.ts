import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findCustomerPhoneConflict,
  isValidPhoneDigits,
  phoneConflictErrorMessage,
} from "@/lib/auth/phoneAccount";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { cleanText, hasSuspiciousInput, normalizePhone, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function PUT(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_phone_put:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
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
      await rateLimitStorefront(`account_phone_put:user:${session.sub}`, 1);
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

    const phone = normalizePhone(rawPhone);
    if (!phone || !isValidPhoneDigits(phone)) {
      return NextResponse.json({ error: "Please enter a valid mobile number" }, { status: 400 });
    }

    const current = await prisma.customers.findUnique({
      where: { id: session.sub },
      select: { phone: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    if (current.phone === phone) {
      return NextResponse.json({ ok: true, phone });
    }

    const conflict = await findCustomerPhoneConflict(phone, session.sub);
    if (conflict) {
      return NextResponse.json({ error: phoneConflictErrorMessage() }, { status: 409 });
    }

    const digitsOnly = phone.replace(/\D/g, "");
    const phoneToStore = digitsOnly.length === 10 ? digitsOnly : phone;

    await prisma.customers.update({
      where: { id: session.sub },
      data: { phone: phoneToStore },
    });

    return NextResponse.json({ ok: true, phone: phoneToStore });
  });
}
