import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { prisma } from "@/lib/prisma";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

export async function GET() {
  return runAdminApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = await prisma.admin_users.findUnique({
      where: { id: auth.session.sub },
      select: { totp_enabled: true, email: true },
    });
    if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      enabled: admin.totp_enabled,
      email: admin.email,
    });
  }, { name: "GET /api/admin/auth/2fa/status" });
}
