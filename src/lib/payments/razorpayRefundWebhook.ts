import { Prisma, type payment_status_type } from "@prisma/client";
import { after } from "next/server";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { revalidateInventoryCatalog } from "@/lib/cache/revalidate";
import { sendRefundConfirmationEmail } from "@/lib/email/refundConfirmationEmail";
import {
  orderPaymentCountedAsSold,
  restoreSoldInventoryForOrder,
} from "@/lib/inventory/orderInventoryRestore";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";

type RazorpayRefundWebhook = {
  event?: string;
  payload?: {
    refund?: {
      entity?: {
        id?: string;
        amount?: number;
        payment_id?: string;
      };
    };
  };
};

const REFUND_ERROR_MAX = 2000;

/** Definitive refund success events; payment.refunded kept as Razorpay alias. */
const REFUND_SUCCESS_EVENTS = new Set(["refund.processed", "payment.refunded"]);

function trimError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
  return message.slice(0, REFUND_ERROR_MAX);
}

async function saveRefundError(orderId: string, message: string) {
  try {
    await prisma.orders.update({
      where: { id: orderId },
      data: { refund_error: message.slice(0, REFUND_ERROR_MAX) },
    });
  } catch (err) {
    console.error("[razorpay-refund-webhook] failed to persist refund_error", {
      orderId,
      message,
      err,
    });
  }
}

function parseRefundWebhook(rawBody: string): RazorpayRefundWebhook | null {
  try {
    return JSON.parse(rawBody) as RazorpayRefundWebhook;
  } catch (err) {
    console.error("[razorpay-refund-webhook] invalid JSON", err);
    return null;
  }
}

function resolveRefundFields(event: RazorpayRefundWebhook) {
  const refund = event.payload?.refund?.entity;

  const refundId = String(refund?.id ?? "").trim();
  const paymentId = String(refund?.payment_id ?? "").trim();
  const amount = refund?.amount;

  if (!paymentId) {
    throw new Error(
      "Refund webhook missing refund.entity.payment_id — cannot match order to Razorpay payment"
    );
  }

  return {
    refundId,
    paymentId,
    amount: typeof amount === "number" && Number.isFinite(amount) ? Math.trunc(amount) : null,
  };
}

function orderTotalPaise(totalAmount: Prisma.Decimal): number {
  return parseInt(new Prisma.Decimal(totalAmount).mul(100).toFixed(0), 10);
}

function resolvePaymentStatus(
  cumulativeRefundPaise: number,
  orderTotalPaise: number
): payment_status_type {
  return cumulativeRefundPaise >= orderTotalPaise ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

function shouldRestoreInventoryOnFullRefund(
  orderStatus: string,
  paymentStatus: string
): boolean {
  if (orderStatus === "REFUNDED") return false;
  return (
    orderPaymentCountedAsSold(paymentStatus) || paymentStatus === "PARTIALLY_REFUNDED"
  );
}

async function runPostRestoreSideEffects(productIds: string[]) {
  if (!productIds.length) return;
  try {
    await syncLowStockAlertsByProductIds(productIds);
    for (const productId of productIds) {
      revalidateInventoryCatalog({ productId });
    }
  } catch (err) {
    console.error("[razorpay-refund-webhook] post-restore side effects failed", err);
  }
}

export async function handleRazorpayRefundWebhook(rawBody: string): Promise<void> {
  const event = parseRefundWebhook(rawBody);
  if (!event) return;

  const eventName = String(event.event ?? "").trim();

  if (eventName === "refund.created") {
    console.info("[razorpay-refund-webhook] refund.created received (informational, no action)", {
      refundId: event.payload?.refund?.entity?.id,
    });
    return;
  }

  if (!REFUND_SUCCESS_EVENTS.has(eventName)) {
    return;
  }

  let refundId = "";
  let paymentId = "";
  let orderId: string | null = null;

  try {
    const fields = resolveRefundFields(event);
    refundId = fields.refundId;
    paymentId = fields.paymentId;
    const amount = fields.amount;

    if (!refundId || amount === null || amount <= 0) {
      throw new Error(
        `Refund webhook missing required refund fields (refundId=${refundId || "empty"}, amount=${amount})`
      );
    }

    const order = await prisma.orders.findFirst({
      where: {
        external_payment_id: paymentId,
        payment_provider: "razorpay",
      },
      select: {
        id: true,
        order_number: true,
        status: true,
        payment_status: true,
        total_amount: true,
        refund_transaction_id: true,
        refunded_amount: true,
        customers: { select: { email: true } },
      },
    });

    if (!order) {
      console.error("[razorpay-refund-webhook] order not found for payment", { paymentId, refundId });
      return;
    }

    orderId = order.id;

    if (order.refund_transaction_id === refundId) {
      console.info("[razorpay-refund-webhook] duplicate webhook, skipping", {
        orderId: order.id,
        refundId,
      });
      return;
    }

    const totalPaise = orderTotalPaise(order.total_amount);
    const previousRefunded = order.refunded_amount ?? 0;
    const cumulativeRefunded = previousRefunded + amount;
    const paymentStatus = resolvePaymentStatus(cumulativeRefunded, totalPaise);
    const isFullRefund = paymentStatus === "REFUNDED";

    let restoredProductIds: string[] = [];

    if (isFullRefund) {
      const restoreInventory = shouldRestoreInventoryOnFullRefund(
        String(order.status),
        String(order.payment_status)
      );

      const restoreResult = await prisma.$transaction(async (tx) => {
        const restore = await restoreSoldInventoryForOrder(tx, order.id, restoreInventory);
        if (!restore.ok) return restore;

        await tx.orders.update({
          where: { id: order.id },
          data: {
            status: "REFUNDED",
            payment_status: "REFUNDED",
            refund_transaction_id: refundId,
            refunded_amount: { increment: amount },
            refund_error: null,
          },
        });

        return restore;
      }, PRISMA_TRANSACTION_OPTIONS);

      if (!restoreResult.ok) {
        throw new Error(restoreResult.error);
      }

      restoredProductIds = restoreResult.productIds;
    } else {
      await prisma.orders.update({
        where: { id: order.id },
        data: {
          payment_status: "PARTIALLY_REFUNDED",
          refund_transaction_id: refundId,
          refunded_amount: { increment: amount },
          refund_error: null,
        },
      });
    }

    if (restoredProductIds.length > 0) {
      after(() => runPostRestoreSideEffects(restoredProductIds));
    }

    const customerEmail = order.customers?.email ?? null;
    if (!customerEmail || isSyntheticPhoneSignupEmail(customerEmail)) {
      await saveRefundError(order.id, "Refund recorded but customer email is unavailable");
      return;
    }

    const emailTo = displayEmailForCustomer(customerEmail);
    if (!emailTo) {
      await saveRefundError(order.id, "Refund recorded but customer email is unavailable");
      return;
    }

    try {
      const emailResult = await sendRefundConfirmationEmail({
        to: emailTo,
        orderRef: formatOrderReference(order),
        refundTransactionId: refundId,
        refundedAmountPaise: cumulativeRefunded,
      });

      if (!emailResult.ok) {
        await saveRefundError(
          order.id,
          emailResult.skipped
            ? "Refund recorded but email is not configured"
            : "Refund recorded but confirmation email failed"
        );
      }
    } catch (emailErr) {
      console.error("[razorpay-refund-webhook] confirmation email failed", {
        orderId: order.id,
        emailErr,
      });
      await saveRefundError(order.id, `Refund recorded but email failed: ${trimError(emailErr)}`);
    }
  } catch (err) {
    console.error("[razorpay-refund-webhook] processing failed", {
      orderId,
      paymentId,
      refundId,
      err,
    });
    if (orderId) {
      await saveRefundError(orderId, trimError(err));
    }
  }
}
