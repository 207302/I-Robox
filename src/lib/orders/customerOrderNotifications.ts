import { sendEmail, isEmailConfigured, orderUpdateCustomerEmailHtml } from "@/lib/email";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";
import { getSiteBaseUrl } from "@/lib/siteUrl";

export type ShipmentSnapshot = {
  status: string;
  carrier: string | null;
  tracking_number: string | null;
};

function safeSpan(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shipmentChanged(a: ShipmentSnapshot | null, b: ShipmentSnapshot | null) {
  if (!a !== !b) return true;
  if (!a || !b) return false;
  return (
    a.status !== b.status ||
    (a.carrier ?? "") !== (b.carrier ?? "") ||
    (a.tracking_number ?? "") !== (b.tracking_number ?? "")
  );
}

/**
 * Sends one email when order status and/or shipment details change (customer-visible).
 */
export async function notifyCustomerOrderOrShipmentUpdate(input: {
  to: string;
  orderId: string;
  previousOrderStatus: string;
  nextOrderStatus: string;
  previousShipment: ShipmentSnapshot | null;
  nextShipment: ShipmentSnapshot | null;
}) {
  const statusChanged = input.previousOrderStatus !== input.nextOrderStatus;
  const shipChanged = shipmentChanged(input.previousShipment, input.nextShipment);
  if (!statusChanged && !shipChanged) return { ok: true, skipped: true as const };

  if (!isEmailConfigured()) {
    console.warn("[order-notify] SMTP not configured — skipped");
    return { ok: false, skipped: true as const };
  }

  const orderRow = await prisma.orders.findUnique({
    where: { id: input.orderId },
    select: { id: true, order_number: true },
  });
  const orderRef = orderRow ? formatOrderReference(orderRow) : input.orderId;

  const base = getSiteBaseUrl();
  const orderUrl = `${base}/orders/${input.orderId}`;
  const blocks: string[] = [];

  if (statusChanged) {
    blocks.push(
      `<p style="margin:0.75em 0"><strong>Order status:</strong> ${safeSpan(
        input.previousOrderStatus
      )} → <strong>${safeSpan(input.nextOrderStatus)}</strong></p>`
    );
  }
  if (shipChanged && input.nextShipment) {
    blocks.push(`<h3 style="margin:1em 0 0.35em;font-size:1.05em">Shipping</h3>`);
    blocks.push(`<p style="margin:0.35em 0"><strong>Shipment status:</strong> ${safeSpan(input.nextShipment.status)}</p>`);
    if (input.nextShipment.carrier) {
      blocks.push(`<p style="margin:0.35em 0"><strong>Carrier:</strong> ${safeSpan(input.nextShipment.carrier)}</p>`);
    }
    if (input.nextShipment.tracking_number) {
      blocks.push(
        `<p style="margin:0.35em 0"><strong>Tracking number:</strong> ${safeSpan(input.nextShipment.tracking_number)}</p>`
      );
    }
  }

  const html = orderUpdateCustomerEmailHtml({ orderId: orderRef, orderUrl, blocksHtml: blocks });
  const textLines: string[] = [`Order ${orderRef} was updated.`];
  if (statusChanged) textLines.push(`Status: ${input.previousOrderStatus} → ${input.nextOrderStatus}`);
  if (shipChanged && input.nextShipment) {
    textLines.push(`Shipment: ${input.nextShipment.status}`);
    if (input.nextShipment.carrier) textLines.push(`Carrier: ${input.nextShipment.carrier}`);
    if (input.nextShipment.tracking_number) textLines.push(`Tracking: ${input.nextShipment.tracking_number}`);
  }
  textLines.push(`View order: ${orderUrl}`);

  const subjectHint =
    statusChanged && input.nextOrderStatus === "SHIPPED"
      ? "Shipped"
      : statusChanged && input.nextOrderStatus === "DELIVERED"
        ? "Delivered"
        : statusChanged
          ? input.nextOrderStatus
          : shipChanged
            ? "Shipping update"
            : "Update";

  await sendEmail({
    to: input.to,
    subject: `${subjectHint} — order ${orderRef} | i-Robox`,
    html,
    text: textLines.join("\n"),
  });

  return { ok: true, skipped: false as const };
}
