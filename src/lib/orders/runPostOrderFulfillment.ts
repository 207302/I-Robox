import { writeAuditLog } from "@/lib/audit";
import {
  sendEmail,
  orderConfirmedCustomerEmailHtml,
  orderConfirmedCustomerEmailText,
  newGuestAccountPasswordEmailHtml,
  newGuestAccountPasswordEmailText,
} from "@/lib/email";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { loadOrderEmailLines } from "@/lib/email/orderEmailLines";
import { notifyStoreNewOrder } from "@/lib/orders/storeOrderNotifications";
import { bookShipmentForOrder } from "@/lib/shipping";
import { ensureOrderShipmentCreated } from "@/lib/orders/ensureOrderShipment";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";

export type PostOrderFulfillmentInput = {
  orderId: string;
  productIds: string[];
  checkoutEmail: string;
  newAccountPasswordSetup?: { setupUrl: string } | null;
  audit?: {
    customerId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  };
};

/** Non-critical work after payment is confirmed (shipping API, email, alerts). */
export async function runPostOrderFulfillment(input: PostOrderFulfillmentInput) {
  const { orderId, productIds, checkoutEmail, newAccountPasswordSetup, audit } = input;

  try {
    await ensureOrderShipmentCreated(orderId);
  } catch (err) {
    console.error("[postOrderFulfillment] shipment row failed", err);
  }

  await syncLowStockAlertsByProductIds(productIds).catch((err) => {
    console.error("[postOrderFulfillment] low stock alert sync failed", err);
  });

  try {
    await bookShipmentForOrder(orderId);
  } catch (err) {
    console.error("[postOrderFulfillment] shipment booking failed", err);
  }

  if (audit) {
    try {
      await writeAuditLog({
        customerId: audit.customerId,
        entityType: "ORDER",
        entityId: orderId,
        action: "PAYMENT_CONFIRMED",
        newValues: { payment_status: "SUCCEEDED", status: "PENDING", paymentProvider: "razorpay" },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    } catch (err) {
      console.error("[postOrderFulfillment] audit log failed", err);
    }
  }

  try {
    await notifyStoreNewOrder(orderId);
  } catch (err) {
    console.error("[postOrderFulfillment] store order email failed", err);
  }

  if (!checkoutEmail) return;

  const orderRow = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, order_number: true },
  });
  const orderRef = orderRow ? formatOrderReference(orderRow) : orderId;

  let orderLines: Awaited<ReturnType<typeof loadOrderEmailLines>> = [];
  try {
    orderLines = await loadOrderEmailLines(orderId);
  } catch (err) {
    console.error("[postOrderFulfillment] order line images failed", err);
  }

  try {
    await sendEmail({
      to: checkoutEmail,
      subject: "Order placed successfully",
      html: orderConfirmedCustomerEmailHtml({ orderId: orderRef, lines: orderLines }),
      text: orderConfirmedCustomerEmailText({ orderId: orderRef, lines: orderLines }),
    });
  } catch (err) {
    console.error("[postOrderFulfillment] order email failed", err);
  }

  if (newAccountPasswordSetup?.setupUrl) {
    try {
      const loginUrl = `${getSiteBaseUrl()}/login`;
      await sendEmail({
        to: checkoutEmail,
        subject: "Set your password to view your orders | i-Robox",
        html: newGuestAccountPasswordEmailHtml({
          email: checkoutEmail,
          setupUrl: newAccountPasswordSetup.setupUrl,
          orderId: orderRef,
          loginUrl,
        }),
        text: newGuestAccountPasswordEmailText({
          email: checkoutEmail,
          setupUrl: newAccountPasswordSetup.setupUrl,
          orderId: orderRef,
          loginUrl,
        }),
      });
    } catch (err) {
      console.error("[postOrderFulfillment] guest account password email failed", err);
    }
  }
}
