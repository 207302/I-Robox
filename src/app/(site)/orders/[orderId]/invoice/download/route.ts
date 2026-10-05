import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { isOrderOwnedByCustomer } from "@/lib/orders/orderOwnership";
import { resolveLiveCustomerId } from "@/lib/orders/resolveOrderCustomer";
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

  const sessionCustomerId = await resolveLiveCustomerId(session);
  const isOwner = isOrderOwnedByCustomer(order.customer_id, sessionCustomerId);
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
