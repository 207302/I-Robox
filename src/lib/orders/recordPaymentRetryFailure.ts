import { prisma } from "@/lib/prisma";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import {
  PAYMENT_RETRY_MAX_ATTEMPTS,
  getPaymentRetryState,
} from "@/lib/orders/paymentRetry";
import { releaseOrderInventoryReservations } from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { sendPaymentRetryExhaustedEmail } from "@/lib/email/sendPaymentRetryExhaustedEmail";

export async function recordPaymentRetryFailure(orderId: string) {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      payment_status: true,
      payment_retry_attempts: true,
      payment_retry_exhausted_notified_at: true,
    },
  });

  if (!order) return { ok: false as const, error: "not_found" as const };
  if (order.status !== "PAYMENT_FAILED" || order.payment_status !== "FAILED") {
    return { ok: false as const, error: "not_retryable" as const };
  }

  const before = order.payment_retry_attempts;
  if (before >= PAYMENT_RETRY_MAX_ATTEMPTS) {
    return {
      ok: true as const,
      attempts: before,
      retry: getPaymentRetryState(before),
      exhausted: true as const,
    };
  }

  const updated = await prisma.orders.update({
    where: { id: orderId },
    data: {
      payment_retry_attempts: { increment: 1 },
      status: "PAYMENT_FAILED",
      payment_status: "FAILED",
    },
    select: {
      payment_retry_attempts: true,
      payment_retry_exhausted_notified_at: true,
    },
  });

  const retry = getPaymentRetryState(updated.payment_retry_attempts);
  const exhausted = !retry.canRetry;

  if (exhausted) {
    const productIds = await releaseOrderInventoryReservations(orderId).catch((err) => {
      console.error("[payment-retry] release inventory failed", { orderId, err });
      return [] as string[];
    });
    if (productIds.length > 0) {
      await syncLowStockAlertsByProductIds(productIds).catch((err) => {
        console.error("[payment-retry] low stock sync failed", err);
      });
    }
    if (!updated.payment_retry_exhausted_notified_at) {
      await sendPaymentRetryExhaustedEmail(orderId).catch((err) => {
        console.error("[payment-retry] exhausted email failed", { orderId, err });
      });
    }
  }

  return {
    ok: true as const,
    attempts: updated.payment_retry_attempts,
    retry,
    exhausted,
  };
}
