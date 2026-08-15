import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { confirmReservedInventoryAsSold } from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { cancelUnpaidAdminOrder } from "@/lib/orders/cancelUnpaidAdminOrder";
import { runPostOrderFulfillment } from "@/lib/orders/runPostOrderFulfillment";
import { writeAuditLog } from "@/lib/audit";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";

type PaymentLinkWebhookEvent = {
  event?: string;
  payload?: {
    payment_link?: {
      entity?: {
        id?: string;
        reference_id?: string;
        status?: string;
        notes?: Record<string, unknown>;
      };
    };
    payment?: {
      entity?: {
        id?: string;
        notes?: Record<string, unknown>;
      };
    };
  };
};

async function findPaymentLinkOrder(input: {
  paymentLinkId?: string;
  referenceId?: string;
  notesOrderId?: string;
}) {
  if (input.paymentLinkId) {
    const byLink = await prisma.orders.findFirst({
      where: { razorpay_payment_link_id: input.paymentLinkId },
      select: {
        id: true,
        payment_status: true,
        status: true,
        customer_id: true,
        customers: { select: { email: true } },
        order_items: { select: { product_id: true } },
      },
    });
    if (byLink) return byLink;
  }
  const orderId = input.referenceId || input.notesOrderId;
  if (!orderId) return null;
  return prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      payment_status: true,
      status: true,
      customer_id: true,
      customers: { select: { email: true } },
      order_items: { select: { product_id: true } },
    },
  });
}

export async function markAdminPaymentLinkOrderPaid(input: {
  orderId: string;
  paymentId?: string | null;
}): Promise<{ alreadyProcessed: boolean }> {
  const order = await prisma.orders.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      payment_status: true,
      status: true,
      customer_id: true,
      customers: { select: { email: true } },
      order_items: { select: { product_id: true } },
    },
  });
  if (!order) return { alreadyProcessed: true };
  if (order.payment_status === "SUCCEEDED" || order.payment_status === "REFUNDED") {
    return { alreadyProcessed: true };
  }
  if (order.status === "CANCELLED") {
    return { alreadyProcessed: true };
  }

  await prisma.$transaction(async (tx) => {
    await confirmReservedInventoryAsSold(order.id, tx);
    await tx.orders.update({
      where: { id: order.id },
      data: {
        payment_status: "SUCCEEDED",
        status: "PENDING",
        payment_provider: "razorpay",
        ...(input.paymentId ? { external_payment_id: input.paymentId } : {}),
      },
    });
  }, PRISMA_TRANSACTION_OPTIONS);

  const productIds = [...new Set(order.order_items.map((i) => i.product_id))];
  const checkoutFormEmail = displayEmailForCustomer(order.customers?.email ?? "") ?? "";

  after(async () => {
    try {
      await runPostOrderFulfillment({
        orderId: order.id,
        productIds,
        checkoutFormEmail,
        accountEmail: checkoutFormEmail || null,
        audit: {
          customerId: order.customer_id,
          ipAddress: null,
          userAgent: "razorpay-payment-link-webhook",
          action: "ADMIN_PAYMENT_LINK_PAID",
          newValues: { payment_status: "SUCCEEDED", paymentId: input.paymentId ?? null },
        },
      });
      const shipped = await prisma.orders.findUnique({
        where: { id: order.id },
        select: { awb_number: true, status: true },
      });
      if (shipped?.awb_number && shipped.status === "PENDING") {
        await prisma.orders.update({
          where: { id: order.id },
          data: { status: "CONFIRMED" },
        });
      }
    } catch (err) {
      console.error("[payment-link] fulfillment failed", { orderId: order.id, err });
    }
  });

  await writeAuditLog({
    entityType: "ORDER",
    entityId: order.id,
    action: "PAYMENT_LINK_PAID",
    newValues: { paymentId: input.paymentId ?? null },
  });

  return { alreadyProcessed: false };
}

export async function handleRazorpayPaymentLinkWebhook(rawBody: string): Promise<boolean> {
  let event: PaymentLinkWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaymentLinkWebhookEvent;
  } catch {
    return false;
  }

  const eventName = String(event.event ?? "").trim();
  if (!eventName.startsWith("payment_link.")) return false;

  const paymentLinkId = String(event.payload?.payment_link?.entity?.id ?? "").trim();
  const referenceId = String(event.payload?.payment_link?.entity?.reference_id ?? "").trim();
  const notes = event.payload?.payment_link?.entity?.notes;
  const notesOrderId =
    notes && typeof notes === "object" ? String(notes.order_id ?? "").trim() : "";
  const paymentId = String(event.payload?.payment?.entity?.id ?? "").trim();

  const order = await findPaymentLinkOrder({
    paymentLinkId,
    referenceId,
    notesOrderId,
  });
  if (!order) {
    console.error("[payment-link-webhook] no matching order", {
      eventName,
      paymentLinkId,
      referenceId,
    });
    return true;
  }

  if (eventName === "payment_link.paid") {
    await markAdminPaymentLinkOrderPaid({ orderId: order.id, paymentId: paymentId || null });
    return true;
  }

  if (eventName === "payment_link.expired" || eventName === "payment_link.cancelled") {
    if (order.payment_status === "SUCCEEDED") return true;
    await cancelUnpaidAdminOrder({
      orderId: order.id,
      reason: eventName,
    });
    return true;
  }

  return true;
}
