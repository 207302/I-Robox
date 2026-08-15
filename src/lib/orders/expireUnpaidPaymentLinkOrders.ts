import { prisma } from "@/lib/prisma";
import { cancelUnpaidAdminOrder } from "@/lib/orders/cancelUnpaidAdminOrder";

/** Cancel unpaid admin payment-link orders after expire_by. */
export async function expireUnpaidPaymentLinkOrders(): Promise<{ scanned: number; cancelled: number }> {
  const now = new Date();
  const rows = await prisma.orders.findMany({
    where: {
      payment_status: "PENDING",
      status: "PENDING",
      razorpay_payment_link_expires_at: { lte: now },
      razorpay_payment_link_id: { not: null },
    },
    select: { id: true },
    take: 50,
  });

  let cancelled = 0;
  for (const row of rows) {
    const result = await cancelUnpaidAdminOrder({
      orderId: row.id,
      reason: "payment_link_expired",
    });
    if (result.ok) cancelled += 1;
  }
  return { scanned: rows.length, cancelled };
}
