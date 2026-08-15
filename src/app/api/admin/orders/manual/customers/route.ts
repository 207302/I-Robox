import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin/rbac";
import { mapCustomerToAdminRow } from "@/lib/admin/customers";
import { cleanText, hasSuspiciousInput } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { isShippingAddressValid } from "@/lib/validation/address";

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const q = cleanText(req.nextUrl.searchParams.get("q") ?? "", 120);
    if (q && hasSuspiciousInput(q)) {
      return NextResponse.json({ error: "Invalid search" }, { status: 400 });
    }

    const digits = q.replace(/\D/g, "");
    const where =
      q.length > 0
        ? {
            is_active: true,
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : { is_active: true };

    const customers = await prisma.customers.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        is_active: true,
        google_sub: true,
        created_at: true,
        _count: { select: { orders: true } },
        addresses: {
          orderBy: [{ is_default_shipping: "desc" }, { created_at: "desc" }],
          take: 8,
          select: {
            id: true,
            full_name: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
            is_default_shipping: true,
            created_at: true,
          },
        },
      },
    });

    return NextResponse.json({
      customers: customers.map((c) => {
        const validAddresses = c.addresses.filter((a) =>
          isShippingAddressValid({
            full_name: a.full_name,
            phone: a.phone,
            line1: a.line1,
            line2: a.line2,
            city: a.city,
            state: a.state,
            postal_code: a.postal_code,
            country: a.country,
          })
        );
        const latest = validAddresses[0] ?? c.addresses[0] ?? null;
        return {
          ...mapCustomerToAdminRow(c),
          latestAddress: latest
            ? {
                full_name: latest.full_name,
                phone: latest.phone,
                line1: latest.line1,
                line2: latest.line2,
                city: latest.city,
                state: latest.state,
                postal_code: latest.postal_code,
                country: latest.country,
              }
            : null,
        };
      }),
    });
  });
}
