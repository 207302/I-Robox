import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

export async function GET() {
  return runAdminApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await prisma.marketing_notify_signups.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        full_name: true,
        phone: true,
        email: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      total: rows.length,
      items: rows.map((row) => ({
        ...row,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      })),
    });
  }, { name: "GET /api/admin/marketing/notify-signups" });
}
