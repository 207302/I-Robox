import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import {
  cleanText,
  hasSuspiciousInput,
  normalizeEmail,
  normalizePhone,
  readJsonBody,
} from "@/lib/validation/input";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import { runApiRoute } from "@/lib/api/runApiRoute";

function normalizeIndiaMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return null;
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`notify-signup:${req.ip ?? "unknown"}`, 5);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;

    const full_name = cleanText(body.full_name, 150);
    const phoneRaw = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);

    const hasName = Boolean(full_name);
    const hasPhone = Boolean(phoneRaw);
    const emailOnly = !hasName && !hasPhone;

    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (!validateCommonEmailProvider(email)) {
      return NextResponse.json(
        { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
        { status: 400 }
      );
    }

    if (emailOnly) {
      await prisma.marketing_notify_signups.upsert({
        where: { email },
        create: { full_name: "Newsletter Subscriber", phone: "0000000000", email },
        update: { updated_at: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (!full_name || hasSuspiciousInput(full_name)) {
      return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
    }
    const phone = normalizeIndiaMobile(phoneRaw);
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    }
    if (hasSuspiciousInput(email)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await prisma.marketing_notify_signups.upsert({
      where: { email },
      create: { full_name, phone, email },
      update: { full_name, phone, updated_at: new Date() },
    });

    return NextResponse.json({ ok: true });
  });
}
