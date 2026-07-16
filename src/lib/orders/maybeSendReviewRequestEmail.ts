import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import {
  loadReviewRequestLines,
  reviewRequestProductLinesTableHtml,
  reviewRequestProductLinesText,
} from "@/lib/email/reviewRequestEmailLines";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";
import { getReviewRequestSettings } from "@/lib/marketing/getReviewRequestSettings";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { prisma } from "@/lib/prisma";
import { getSiteBaseUrl } from "@/lib/siteUrl";

const BRAND_RED = "#E63946";

type DeliveryTransitionInput = {
  orderId: string;
  previousOrderStatus: string;
  nextOrderStatus: string;
  previousTrackingStep?: string | null;
  nextTrackingStep?: string | null;
};

export type SendReviewRequestResult =
  | { ok: true; sentTo: string; itemCount: number }
  | {
      ok: true;
      skipped: true;
      reason:
        | "disabled"
        | "smtp_not_configured"
        | "already_sent"
        | "no_email"
        | "no_unreviewed_items"
        | "not_delivered"
        | "order_not_found"
        | "waiting_delay"
        | "not_delivered_transition";
    }
  | { ok: false; error: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function orderJustDelivered(input: DeliveryTransitionInput): boolean {
  const prevStep = (input.previousTrackingStep ?? "").trim().toUpperCase();
  const nextStep = (input.nextTrackingStep ?? "").trim().toUpperCase();
  if (nextStep === "DELIVERED" && prevStep !== "DELIVERED") return true;
  return input.nextOrderStatus === "DELIVERED" && input.previousOrderStatus !== "DELIVERED";
}

function reviewRequestEmailHtml(input: {
  customerName: string;
  orderRef: string;
  linesHtml: string;
  ordersUrl: string;
}) {
  const name = escapeHtml(input.customerName || "there");
  const orderRef = escapeHtml(input.orderRef);
  const ordersUrl = escapeHtml(input.ordersUrl);

  return `
  <div style="font-family:${EMAIL_FONT_FAMILY};line-height:1.6;color:#111;max-width:560px;margin:0 auto;">
    <div style="border-bottom:4px solid ${BRAND_RED};padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.02em;">i-robox</div>
    </div>
    <h2 style="margin:0 0 12px;font-size:20px;color:#111;">How did we do? 🙂</h2>
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">
      Your order <strong>#${orderRef}</strong> has been delivered. We'd love to hear what you think about the items you received.
    </p>
    ${input.linesHtml}
    <p style="margin:0 0 20px;font-size:14px;color:#555;">
      Sign in with the email you used at checkout, open the product page, and share your rating and feedback. Reviews help fellow collectors choose with confidence.
    </p>
    <p style="margin:0 0 20px;">
      <a href="${ordersUrl}" style="color:#111;font-weight:600;text-decoration:underline;">View your orders</a>
    </p>
    <p style="margin:0;font-size:13px;color:#555;">
      Thank you for shopping with i-robox!
    </p>
  </div>
  `;
}

async function reviewRequestAlreadySent(orderId: string): Promise<boolean> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { review_request_email_sent_at: true },
  });
  if (order?.review_request_email_sent_at) return true;

  const shipment = await prisma.shipments.findUnique({
    where: { order_id: orderId },
    select: { metadata: true },
  });
  const meta =
    shipment?.metadata && typeof shipment.metadata === "object"
      ? (shipment.metadata as Record<string, unknown>)
      : {};
  return typeof meta.reviewRequestEmailSentAt === "string" && meta.reviewRequestEmailSentAt.length > 0;
}

async function markReviewRequestSent(orderId: string) {
  const sentAt = new Date();
  await prisma.orders.update({
    where: { id: orderId },
    data: { review_request_email_sent_at: sentAt },
  });

  const existing = await prisma.shipments.findUnique({
    where: { order_id: orderId },
    select: { metadata: true },
  });
  const prevMeta =
    existing?.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  await prisma.shipments.upsert({
    where: { order_id: orderId },
    create: {
      order_id: orderId,
      metadata: {
        reviewRequestEmailSentAt: sentAt.toISOString(),
      } as object,
    },
    update: {
      metadata: {
        ...prevMeta,
        reviewRequestEmailSentAt: sentAt.toISOString(),
      } as object,
    },
  });
}

/** Ensure shipment has a delivered_at so delay cron can schedule correctly. */
async function ensureDeliveredTimestamp(orderId: string) {
  const shipment = await prisma.shipments.findUnique({
    where: { order_id: orderId },
    select: { delivered_at: true, metadata: true },
  });
  if (shipment?.delivered_at) return;

  const now = new Date();
  const prevMeta =
    shipment?.metadata && typeof shipment.metadata === "object"
      ? (shipment.metadata as Record<string, unknown>)
      : {};

  await prisma.shipments.upsert({
    where: { order_id: orderId },
    create: {
      order_id: orderId,
      status: "DELIVERED",
      delivered_at: now,
    },
    update: {
      delivered_at: now,
      status: "DELIVERED",
      metadata: prevMeta as object,
    },
  });

  await prisma.orders.update({
    where: { id: orderId },
    data: {
      shipment_status: "DELIVERED",
      shipment_updated_at: now,
    },
  });
}

/**
 * Send review-request email for one order.
 * Only emails product lines that still have no review.
 * `force` allows resend even if already marked sent (still skips if nothing left to review).
 */
export async function sendReviewRequestEmailForOrder(
  orderId: string,
  opts?: { force?: boolean }
): Promise<SendReviewRequestResult> {
  if (!isEmailConfigured()) {
    console.warn("[review-request-email] SMTP not configured — skipped", { orderId });
    return { ok: true, skipped: true, reason: "smtp_not_configured" };
  }

  if (!opts?.force && (await reviewRequestAlreadySent(orderId))) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      order_number: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: { select: { full_name: true } },
    },
  });

  if (!order) {
    return { ok: false, error: "order_not_found" };
  }

  if (order.status !== "DELIVERED") {
    return { ok: true, skipped: true, reason: "not_delivered" };
  }

  const rawEmail = order.customers?.email ?? null;
  if (!rawEmail || isSyntheticPhoneSignupEmail(rawEmail)) {
    return { ok: true, skipped: true, reason: "no_email" };
  }

  const to = displayEmailForCustomer(rawEmail);
  if (!to) {
    return { ok: true, skipped: true, reason: "no_email" };
  }

  const lines = await loadReviewRequestLines(orderId);
  if (lines.length === 0) {
    await markReviewRequestSent(orderId);
    return { ok: true, skipped: true, reason: "no_unreviewed_items" };
  }

  const customerName =
    order.addresses_orders_shipping_address_idToaddresses?.full_name?.trim() ||
    order.customers?.name?.trim() ||
    "there";
  const orderRef = formatOrderReference(order);
  const base = getSiteBaseUrl().replace(/\/$/, "");
  const ordersUrl = `${base}/orders/${order.id}`;
  const linesHtml = reviewRequestProductLinesTableHtml(lines);

  const html = reviewRequestEmailHtml({
    customerName,
    orderRef,
    linesHtml,
    ordersUrl,
  });

  const text = [
    `Hi ${customerName},`,
    "",
    `Your order #${orderRef} has been delivered. We'd love to hear what you think:`,
    "",
    ...reviewRequestProductLinesText(lines),
    "",
    "Sign in with your checkout email to leave a review on each product page.",
    `View your orders: ${ordersUrl}`,
    "",
    "Thank you for shopping with i-robox!",
  ].join("\n");

  const subject =
    lines.length === 1
      ? `How was ${lines[0].name}? Leave a review | i-Robox`
      : `Your order #${orderRef} was delivered — leave a review | i-Robox`;

  await sendEmail({ to, subject, html, text });
  await markReviewRequestSent(orderId);

  console.info("[review-request-email] sent", { orderId, to, itemCount: lines.length });
  return { ok: true, sentTo: to, itemCount: lines.length };
}

/**
 * On first delivery transition: send immediately when delay is 0, otherwise wait for cron.
 */
export async function maybeSendReviewRequestEmail(
  input: DeliveryTransitionInput
): Promise<SendReviewRequestResult> {
  if (!orderJustDelivered(input)) {
    return { ok: true, skipped: true, reason: "not_delivered_transition" };
  }

  await ensureDeliveredTimestamp(input.orderId);

  const settings = await getReviewRequestSettings();
  if (!settings.enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  if (settings.delayHours > 0) {
    return { ok: true, skipped: true, reason: "waiting_delay" };
  }

  return sendReviewRequestEmailForOrder(input.orderId);
}
