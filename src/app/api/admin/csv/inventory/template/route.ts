import { NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { inventoryCsvTemplate } from "@/lib/admin/csvFormats";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  
    const csv = "\uFEFF" + inventoryCsvTemplate();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Inventory.csv"',
      },
    });
  
  });}
