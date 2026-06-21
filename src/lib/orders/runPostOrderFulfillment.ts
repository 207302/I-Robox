import { writeAuditLog } from "@/lib/audit";
import {
  sendEmail,
  orderConfirmedCustomerEmailHtml,
  orderConfirmedCustomerEmailText,
  newGuestAccountPasswordEmailHtml,
  newGuestAccountPasswordEmailText,
  type EmailAttachment,
} from "@/lib/email";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { loadOrderEmailLines } from "@/lib/email/orderEmailLines";
import { notifyStoreNewOrder } from "@/lib/orders/storeOrderNotifications";
import { bookShipmentForOrder } from "@/lib/shipping";
import { ensureOrderShipmentCreated } from "@/lib/orders/ensureOrderShipment";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";
import { generateOrderInvoicePdf } from "@/lib/invoices/generateOrderInvoicePdf";
import {
  collectOrderNotificationEmails,
  sendEmailToRecipients,
} from "@/lib/orders/orderNotificationEmails";
import { clearCustomerServerCart } from "@/lib/cart/clearCustomerServerCart";

export type PostOrderFulfillmentInput = {
  orderId: string;
  productIds: string[];
  /** Email typed on the checkout form. */
  checkoutFormEmail: string;
  /** Registered account email when the buyer was signed in. */
  accountEmail?: string | null;
  newAccountPasswordSetup?: { setupUrl: string } | null;
  audit?: {
    customerId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  };
};

/** Non-critical work after payment is confirmed (shipping API, email, alerts). */
export async function runPostOrderFulfillment(input: PostOrderFulfillmentInput) {
  const {
    orderId,
    productIds,
    checkoutFormEmail,
    accountEmail,
    newAccountPasswordSetup,
    audit,
  } = input;

  if (audit?.customerId) {
    try {
      await clearCustomerServerCart(audit.customerId);
    } catch (err) {
      console.error("[postOrderFulfillment] clear server cart failed", err);
    }
  }

  try {
    await ensureOrderShipmentCreated(orderId);
  } catch (err) {
    console.error("[postOrderFulfillment] shipment row failed", err);
  }

  await syncLowStockAlertsByProductIds(productIds).catch((err) => {
    console.error("[postOrderFulfillment] low stock alert sync failed", err);
  });

  try {
    let bookingResult = await bookShipmentForOrder(orderId);
    if (!bookingResult.ok && !bookingResult.skipped) {
      for (let attempt = 1; attempt < 3; attempt++) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        bookingResult = await bookShipmentForOrder(orderId, { force: true });
        if (bookingResult.ok || bookingResult.skipped) break;
      }
    }
    if (!bookingResult.ok && !bookingResult.skipped) {
      console.error("[postOrderFulfillment] shipment booking failed", {
        orderId,
        reason: bookingResult.reason,
        error: bookingResult.error,
      });
    }
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

  const recipients = collectOrderNotificationEmails(checkoutFormEmail, accountEmail);
  if (recipients.length === 0) return;

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
    let attachments: EmailAttachment[] | undefined;
    try {
      const invoice = await generateOrderInvoicePdf(orderId);
      if (invoice) {
        attachments = [
          {
            filename: invoice.filename,
            content: Buffer.from(invoice.data),
            contentType: "application/pdf",
          },
        ];
      }
    } catch (invoiceErr) {
      console.error("[postOrderFulfillment] invoice pdf failed", invoiceErr);
    }

    await sendEmailToRecipients({
      recipients,
      subject: "Order placed successfully",
      html: orderConfirmedCustomerEmailHtml({ orderId: orderRef, lines: orderLines }),
      text: orderConfirmedCustomerEmailText({ orderId: orderRef, lines: orderLines }),
      attachments,
    });
  } catch (err) {
    console.error("[postOrderFulfillment] order email failed", err);
  }

  if (newAccountPasswordSetup?.setupUrl) {
    try {
      const loginUrl = `${getSiteBaseUrl()}/login`;
      await sendEmail({
        to: checkoutFormEmail,
        subject: "Set your password to view your orders | i-Robox",
        html: newGuestAccountPasswordEmailHtml({
          email: checkoutFormEmail,
          setupUrl: newAccountPasswordSetup.setupUrl,
          orderId: orderRef,
          loginUrl,
        }),
        text: newGuestAccountPasswordEmailText({
          email: checkoutFormEmail,
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
