import { prisma } from "@/lib/prisma";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { releaseOrderInventoryReservations } from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { cancelRazorpayPaymentLink } from "@/lib/payments/razorpayPaymentLink";
import { writeAuditLog } from "@/lib/audit";

export async function cancelUnpaidAdminOrder(input: {
  orderId: string;
  adminUserId?: string | null;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const order = await prisma.orders.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      payment_status: true,
      razorpay_payment_link_id: true,
    },
  });
  if (!order) return { ok: false, error: "Order not found", status: 404 };
  if (order.payment_status === "SUCCEEDED") {
    return { ok: false, error: "Paid orders cannot be auto-cancelled this way", status: 409 };
  }
  if (order.status === "CANCELLED") return { ok: true };

  const linkId = order.razorpay_payment_link_id;
  await prisma.$transaction(async (tx) => {
    await tx.orders.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        payment_status: "FAILED",
      },
    });
  }, PRISMA_TRANSACTION_OPTIONS);

  await releaseOrderInventoryReservations(order.id);
  if (linkId) await cancelRazorpayPaymentLink(linkId);

  await writeAuditLog({
    adminUserId: input.adminUserId ?? null,
    entityType: "ORDER",
    entityId: order.id,
    action: "ADMIN_ORDER_CANCELLED",
    newValues: { reason: input.reason, status: "CANCELLED", payment_status: "FAILED" },
  });

  return { ok: true };
}
