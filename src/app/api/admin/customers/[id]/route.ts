import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminWrite } from "@/lib/admin/rbac";
import { mapCustomerToAdminRow } from "@/lib/admin/customers";
import {
  findCustomerPhoneConflict,
  phoneConflictErrorMessage,
  phoneLookupVariants,
  displayEmailForCustomer,
} from "@/lib/auth/phoneAccount";
import {
  indianMobileErrorMessage,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/lib/auth/indianMobile";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { validateCommonEmailProvider, validateEmail } from "@/lib/validateEmai";
import { cleanText, hasSuspiciousInput, isUuid, normalizeEmail, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const customer = await prisma.customers.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        is_active: true,
        google_sub: true,
        created_at: true,
        _count: { select: { orders: true } },
      },
    });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ customer: mapCustomerToAdminRow(customer) });
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_customers_put:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const current = await prisma.customers.findUnique({
      where: { id },
      select: { id: true, email: true, phone: true, name: true },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: { name?: string; email?: string; phone?: string | null } = {};

    if (parsed.body.name !== undefined) {
      const name = cleanText(parsed.body.name, 150);
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (hasSuspiciousInput(name)) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      data.name = name;
    }

    if (parsed.body.email !== undefined) {
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
      if (email !== current.email.trim().toLowerCase()) {
        const taken = await prisma.customers.findFirst({
          where: { email, NOT: { id } },
          select: { id: true },
        });
        if (taken) {
          return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
        }
        data.email = email;
      }
    }

    if (parsed.body.phone !== undefined) {
      if (parsed.body.phone === null || parsed.body.phone === "") {
        data.phone = null;
      } else {
        const rawPhone = cleanText(parsed.body.phone, 30);
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
        const currentVariants = current.phone ? phoneLookupVariants(current.phone) : [];
        if (!currentVariants.includes(newPhone) && current.phone !== newPhone) {
          const conflict = await findCustomerPhoneConflict(newPhone, id);
          if (conflict) {
            return NextResponse.json({ error: phoneConflictErrorMessage() }, { status: 409 });
          }
          data.phone = newPhone;
        }
      }
    }

    if (!data.name && !data.email && data.phone === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.customers.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        is_active: true,
        google_sub: true,
        created_at: true,
        _count: { select: { orders: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      customer: mapCustomerToAdminRow(updated),
      displayEmail: displayEmailForCustomer(updated.email),
    });
  });
}
