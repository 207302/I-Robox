import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import {
  loadReviewRequestLines,
  reviewRequestProductLinesTableHtml,
  reviewRequestProductLinesText,
} from "@/lib/email/reviewRequestEmailLines";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";
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
        reviewRequestEmailSentAt: new Date().toISOString(),
      } as object,
    },
    update: {
      metadata: {
        ...prevMeta,
        reviewRequestEmailSentAt: new Date().toISOString(),
      } as object,
    },
  });
}

/** Sends a product-specific review request after an order is first marked delivered. */
export async function maybeSendReviewRequestEmail(input: DeliveryTransitionInput) {
  if (!orderJustDelivered(input)) {
    return { ok: true, skipped: true as const, reason: "not_delivered_transition" as const };
  }

  if (!isEmailConfigured()) {
    console.warn("[review-request-email] SMTP not configured — skipped", { orderId: input.orderId });
    return { ok: false, skipped: true as const, reason: "smtp_not_configured" as const };
  }

  if (await reviewRequestAlreadySent(input.orderId)) {
    return { ok: true, skipped: true as const, reason: "already_sent" as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      order_number: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: { select: { full_name: true } },
    },
  });

  if (!order) {
    return { ok: false, error: "order_not_found" as const };
  }

  const rawEmail = order.customers?.email ?? null;
  if (!rawEmail || isSyntheticPhoneSignupEmail(rawEmail)) {
    return { ok: true, skipped: true as const, reason: "no_email" as const };
  }

  const to = displayEmailForCustomer(rawEmail);
  if (!to) {
    return { ok: true, skipped: true as const, reason: "no_email" as const };
  }

  const lines = await loadReviewRequestLines(input.orderId);
  if (lines.length === 0) {
    await markReviewRequestSent(input.orderId);
    return { ok: true, skipped: true as const, reason: "no_unreviewed_items" as const };
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
  await markReviewRequestSent(input.orderId);

  console.info("[review-request-email] sent", { orderId: input.orderId, to, itemCount: lines.length });
  return { ok: true, sentTo: to, itemCount: lines.length };
}
