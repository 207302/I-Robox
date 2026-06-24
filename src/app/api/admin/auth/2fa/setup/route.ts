import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { prisma } from "@/lib/prisma";
import { createAdminTotpSetup } from "@/lib/auth/adminTotp";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

export async function POST() {
  return runAdminApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = await prisma.admin_users.findUnique({
      where: { id: auth.session.sub },
      select: { email: true, totp_enabled: true },
    });
    if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (admin.totp_enabled) {
      return NextResponse.json({ error: "Two-factor authentication is already enabled." }, { status: 400 });
    }

    const setup = createAdminTotpSetup(admin.email);
    return NextResponse.json(setup);
  }, { name: "POST /api/admin/auth/2fa/setup" });
}
