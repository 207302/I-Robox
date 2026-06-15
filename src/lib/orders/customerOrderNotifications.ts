import { sendEmail, isEmailConfigured, orderUpdateCustomerEmailHtml } from "@/lib/email";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import type { ShipmozoTrackingStatus } from "@/lib/shipping/shipmozoTrackingConstants";
import {
  shipmozoTrackingBarEmailHtml,
  shipmozoTrackingBarEmailText,
} from "@/lib/email/shipmozoTrackingBarEmail";
import { shipmozoPublicTrackUrl } from "@/lib/shipping/shipmozoPublicTrackUrl";

export type ShipmentSnapshot = {
  status: string;
  carrier: string | null;
  tracking_number: string | null;
};

const TRACKING_STEP_LABELS: Record<ShipmozoTrackingStatus, string> = {
  ORDER_PLACED: "Order Placed",
  PICKUP_GENERATED: "Pickup Generated",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
};

export function shipmozoTrackingStepLabel(step: string | null | undefined): string {
  const key = (step ?? "").trim().toUpperCase() as ShipmozoTrackingStatus;
  return TRACKING_STEP_LABELS[key] ?? (step?.trim() || "—");
}

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
  previousTrackingStep?: string | null;
  nextTrackingStep?: string | null;
}) {
  const statusChanged = input.previousOrderStatus !== input.nextOrderStatus;
  const shipChanged = shipmentChanged(input.previousShipment, input.nextShipment);
  const prevStep = (input.previousTrackingStep ?? "").trim();
  const nextStep = (input.nextTrackingStep ?? "").trim();
  const trackingStepChanged = Boolean(nextStep) && prevStep !== nextStep;
  if (!statusChanged && !shipChanged && !trackingStepChanged) {
    return { ok: true, skipped: true as const };
  }

  if (!isEmailConfigured()) {
    console.warn("[order-notify] SMTP not configured — skipped");
    return { ok: false, skipped: true as const };
  }

  const orderRow = await prisma.orders.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      order_number: true,
      shipment_status: true,
      awb_number: true,
      carrier: true,
    },
  });
  const orderRef = orderRow ? formatOrderReference(orderRow) : input.orderId;
  const awb =
    (input.nextShipment?.tracking_number ?? orderRow?.awb_number ?? "").trim() || null;
  const trackUrl = awb ? shipmozoPublicTrackUrl(awb) : null;

  const base = getSiteBaseUrl();
  const orderUrl = `${base}/orders/${input.orderId}`;
  const blocks: string[] = [];

  const trackingStatus =
    nextStep ||
    orderRow?.shipment_status ||
    (input.nextShipment?.tracking_number ? "PICKUP_GENERATED" : "");
  const showTrackingBar = Boolean(trackingStatus) && (trackingStepChanged || shipChanged);
  if (showTrackingBar) {
    blocks.push(
      shipmozoTrackingBarEmailHtml({
        status: trackingStatus,
        carrier: input.nextShipment?.carrier ?? orderRow?.carrier,
        awbNumber: input.nextShipment?.tracking_number ?? orderRow?.awb_number,
      })
    );
  }

  if (statusChanged) {
    blocks.push(
      `<p style="margin:0.75em 0"><strong>Order status:</strong> ${safeSpan(
        input.previousOrderStatus
      )} → <strong>${safeSpan(input.nextOrderStatus)}</strong></p>`
    );
  }
  if (trackingStepChanged) {
    blocks.push(
      `<p style="margin:0.75em 0"><strong>Tracking progress:</strong> ${safeSpan(
        shipmozoTrackingStepLabel(prevStep)
      )} → <strong>${safeSpan(shipmozoTrackingStepLabel(nextStep))}</strong></p>`
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
      if (trackUrl) {
        const safeTrackUrl = trackUrl.replace(/"/g, "&quot;").replace(/</g, "&lt;");
        blocks.push(
          `<p style="margin:0.35em 0"><a href="${safeTrackUrl}" target="_blank" rel="noopener noreferrer" style="color:#E63946;font-size:13px;font-weight:600;text-decoration:none;">Track on ShipMozo &rarr;</a></p>`
        );
      }
    }
  }

  const html = orderUpdateCustomerEmailHtml({
    orderId: orderRef,
    orderUrl,
    blocksHtml: blocks,
    trackUrl,
  });
  const textLines: string[] = [`Order ${orderRef} was updated.`];
  if (statusChanged) textLines.push(`Status: ${input.previousOrderStatus} → ${input.nextOrderStatus}`);
  if (trackingStepChanged) {
    textLines.push(
      `Tracking: ${shipmozoTrackingStepLabel(prevStep)} → ${shipmozoTrackingStepLabel(nextStep)}`
    );
    textLines.push(shipmozoTrackingBarEmailText(nextStep));
  }
  if (shipChanged && input.nextShipment) {
    textLines.push(`Shipment: ${input.nextShipment.status}`);
    if (input.nextShipment.carrier) textLines.push(`Carrier: ${input.nextShipment.carrier}`);
    if (input.nextShipment.tracking_number) textLines.push(`Tracking: ${input.nextShipment.tracking_number}`);
    if (showTrackingBar) textLines.push(shipmozoTrackingBarEmailText(trackingStatus));
  }
  if (trackUrl) textLines.push(`Track on ShipMozo: ${trackUrl}`);
  textLines.push(`View order: ${orderUrl}`);

  const subjectHint =
    trackingStepChanged && nextStep === "DELIVERED"
      ? "Delivered"
      : trackingStepChanged && nextStep === "OUT_FOR_DELIVERY"
        ? "Out for delivery"
        : statusChanged && input.nextOrderStatus === "SHIPPED"
          ? "Shipped"
          : statusChanged && input.nextOrderStatus === "DELIVERED"
            ? "Delivered"
            : trackingStepChanged
              ? shipmozoTrackingStepLabel(nextStep)
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

/**
 * Customer email after ShipMozo sync/webhook updates tracking (automation path).
 * Skips generic update when the dedicated pickup email was just sent.
 */
export async function notifyCustomerAfterShipmozoUpdate(input: {
  orderId: string;
  previousOrderStatus: string;
  nextOrderStatus: string;
  previousShipment: ShipmentSnapshot | null;
  nextShipment: ShipmentSnapshot | null;
  previousTrackingStep: string;
  nextTrackingStep: string;
  skipGenericBecausePickupEmailSent?: boolean;
}) {
  if (
    input.skipGenericBecausePickupEmailSent &&
    input.nextTrackingStep === "PICKUP_GENERATED"
  ) {
    return { ok: true, skipped: true as const, reason: "pickup_email_sent" as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: input.orderId },
    select: { customers: { select: { email: true } } },
  });
  const rawEmail = order?.customers?.email ?? null;
  if (!rawEmail || isSyntheticPhoneSignupEmail(rawEmail)) {
    return { ok: true, skipped: true as const, reason: "no_email" as const };
  }

  const to = displayEmailForCustomer(rawEmail);
  if (!to) return { ok: true, skipped: true as const, reason: "no_email" as const };

  try {
    return await notifyCustomerOrderOrShipmentUpdate({
      to,
      orderId: input.orderId,
      previousOrderStatus: input.previousOrderStatus,
      nextOrderStatus: input.nextOrderStatus,
      previousShipment: input.previousShipment,
      nextShipment: input.nextShipment,
      previousTrackingStep: input.previousTrackingStep,
      nextTrackingStep: input.nextTrackingStep,
    });
  } catch (err) {
    console.error("[shipmozo-notify] customer email failed", { orderId: input.orderId, err });
    return { ok: false as const, error: "notify_failed" };
  }
}
