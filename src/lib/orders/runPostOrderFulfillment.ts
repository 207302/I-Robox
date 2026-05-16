import { writeAuditLog } from "@/lib/audit";
import {
  sendEmail,
  orderConfirmedCustomerEmailHtml,
  orderConfirmedCustomerEmailText,
} from "@/lib/email";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { bookShipmentForOrder } from "@/lib/shipping";
import { ensureOrderShipmentCreated } from "@/lib/orders/ensureOrderShipment";

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
        newValues: { status: "CONFIRMED", paymentProvider: "razorpay" },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    } catch (err) {
      console.error("[postOrderFulfillment] audit log failed", err);
    }
  }

  if (!checkoutEmail) return;

  try {
    const passwordSetup = newAccountPasswordSetup
      ? { email: checkoutEmail, setupUrl: newAccountPasswordSetup.setupUrl }
      : undefined;
    await sendEmail({
      to: checkoutEmail,
      subject: newAccountPasswordSetup
        ? "Order placed — set your password (see email)"
        : "Order placed successfully",
      html: orderConfirmedCustomerEmailHtml({ orderId, passwordSetup }),
      text: orderConfirmedCustomerEmailText({ orderId, passwordSetup }),
    });
  } catch (err) {
    console.error("[postOrderFulfillment] order email failed", err);
  }
}
