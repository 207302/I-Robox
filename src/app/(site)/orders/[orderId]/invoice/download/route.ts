import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { generateOrderInvoicePdf } from "@/lib/invoices/generateOrderInvoicePdf";

export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  const access = new URL(req.url).searchParams.get("access") ?? "";
  const session = await getSession();

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, customer_id: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
  const hasCheckoutAccess = Boolean(access && verifyOrderAccessToken(access, order.id));
  if (!isOwner && !hasCheckoutAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = await generateOrderInvoicePdf(orderId);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(invoice.data), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
