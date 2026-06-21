import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { runShipmozoConfigCheck } from "@/lib/shipping/shipmozo";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await runShipmozoConfigCheck();
    return NextResponse.json({ ok: true, ...result });
  });
}
