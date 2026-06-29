import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { PAYMENT_RETRY_MAX_ATTEMPTS } from "@/lib/orders/paymentRetry";
import { prisma } from "@/lib/prisma";
import { getSiteBaseUrl } from "@/lib/siteUrl";

const BRAND_RED = "#E63946";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPaymentRetryExhaustedEmail(orderId: string) {
  if (!isEmailConfigured()) {
    console.warn("[payment-retry-exhausted] SMTP not configured — skipped", { orderId });
    return { ok: false, skipped: true as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      payment_retry_attempts: true,
      payment_retry_exhausted_notified_at: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: { select: { full_name: true } },
    },
  });

  if (!order?.customers?.email || isSyntheticPhoneSignupEmail(order.customers.email)) {
    return { ok: true, skipped: true as const, reason: "no_email" as const };
  }
  if (order.payment_retry_exhausted_notified_at) {
    return { ok: true, skipped: true as const, reason: "already_sent" as const };
  }

  const to = displayEmailForCustomer(order.customers.email);
  if (!to) return { ok: true, skipped: true as const, reason: "no_email" as const };

  const orderRef = formatOrderReference(order);
  const customerName =
    order.addresses_orders_shipping_address_idToaddresses?.full_name?.trim() ||
    order.customers.name?.trim() ||
    "there";
  const ordersUrl = `${getSiteBaseUrl().replace(/\/$/, "")}/orders/${order.id}`;
  const contactUrl = `${getSiteBaseUrl().replace(/\/$/, "")}/contact`;

  const html = `
  <div style="font-family:${EMAIL_FONT_FAMILY};line-height:1.6;color:#111;max-width:560px;margin:0 auto;">
    <div style="border-bottom:4px solid ${BRAND_RED};padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.02em;">i-robox</div>
    </div>
    <h2 style="margin:0 0 12px;font-size:20px;color:#111;">Payment retry attempts used</h2>
    <p style="margin:0 0 16px;">Hi ${escapeHtml(customerName)},</p>
    <p style="margin:0 0 16px;">
      We could not complete payment for order <strong>#${escapeHtml(orderRef)}</strong> after
      ${PAYMENT_RETRY_MAX_ATTEMPTS} retry attempts. The order remains unpaid and items may no longer be reserved.
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;">
      You can place a new order from our shop, or contact us if you believe a charge went through.
    </p>
    <p style="margin:0 0 12px;">
      <a href="${escapeHtml(ordersUrl)}" style="color:#111;font-weight:600;">View order</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(contactUrl)}" style="color:#111;font-weight:600;">Contact support</a>
    </p>
  </div>
  `;

  const text = [
    `Hi ${customerName},`,
    "",
    `Payment for order #${orderRef} could not be completed after ${PAYMENT_RETRY_MAX_ATTEMPTS} retry attempts.`,
    "The order is still marked as payment failed.",
    "",
    `View order: ${ordersUrl}`,
    `Contact support: ${contactUrl}`,
  ].join("\n");

  await sendEmail({
    to,
    subject: `Payment retries failed — order #${orderRef} | i-Robox`,
    html,
    text,
  });

  await prisma.orders.update({
    where: { id: orderId },
    data: { payment_retry_exhausted_notified_at: new Date() },
  });

  return { ok: true, sentTo: to };
}
