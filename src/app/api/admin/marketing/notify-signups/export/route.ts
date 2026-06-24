import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { jsonRowsToXlsxBuffer } from "@/lib/admin/spreadsheet";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

function formatIstDateTime(value: Date) {
  return value.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export async function GET() {
  return runAdminApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await prisma.marketing_notify_signups.findMany({
      orderBy: { created_at: "desc" },
      select: {
        full_name: true,
        phone: true,
        email: true,
        created_at: true,
        updated_at: true,
      },
    });

    const sheetRows = rows.map((row) => ({
      "Full name": row.full_name,
      Mobile: row.phone,
      Email: row.email,
      "First signed up (IST)": formatIstDateTime(row.created_at),
      "Last updated (IST)": formatIstDateTime(row.updated_at),
    }));

    const buffer = await jsonRowsToXlsxBuffer(sheetRows, "Latest drops");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="latest-drop-signups-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }, { name: "GET /api/admin/marketing/notify-signups/export" });
}
