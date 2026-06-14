import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { isUuid } from "@/lib/validation/input";
import { generateOrderInvoicePdf } from "@/lib/invoices/generateOrderInvoicePdf";
import { prisma } from "@/lib/prisma";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const exists = await prisma.orders.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const invoice = await generateOrderInvoicePdf(id);
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(Buffer.from(invoice.data), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
