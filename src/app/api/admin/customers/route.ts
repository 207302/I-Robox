import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/rbac";
import { mapCustomerToAdminRow } from "@/lib/admin/customers";
import { cleanText, hasSuspiciousInput } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const q = cleanText(req.nextUrl.searchParams.get("q") ?? "", 120);
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    if (q && hasSuspiciousInput(q)) {
      return NextResponse.json({ error: "Invalid search" }, { status: 400 });
    }

    const digits = q.replace(/\D/g, "");
    const where =
      q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : undefined;

    const [total, customers] = await Promise.all([
      prisma.customers.count({ where }),
      prisma.customers.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
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
      }),
    ]);

    return NextResponse.json({
      customers: customers.map(mapCustomerToAdminRow),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });
}
