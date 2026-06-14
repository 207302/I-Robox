import { prisma } from "@/lib/prisma";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { shipmozoTrackingBarEmailHtml, shipmozoTrackingBarEmailText } from "@/lib/email/shipmozoTrackingBarEmail";

const BRAND_RED = "#E63946";
const TRACK_URL = "https://panel.shipmozo.com/track-order";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pickupEmailHtml(input: {
  customerName: string;
  orderRef: string;
  carrier: string;
  awbNumber: string;
}) {
  const name = escapeHtml(input.customerName || "there");
  const orderRef = escapeHtml(input.orderRef);
  const carrier = escapeHtml(input.carrier || "our courier partner");
  const awb = escapeHtml(input.awbNumber);
  const trackUrl = TRACK_URL;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;">
    <div style="border-bottom:4px solid ${BRAND_RED};padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.02em;">i-robox</div>
    </div>
    <h2 style="margin:0 0 12px;font-size:20px;color:#111;">Your order is on its way!</h2>
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">
      Your order <strong>#${orderRef}</strong> has been picked up and is now with <strong>${carrier}</strong>.
    </p>
    ${shipmozoTrackingBarEmailHtml({ status: "PICKUP_GENERATED", includeDetails: false })}
    <div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:13px;color:#555;">AWB / Tracking number</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#111;letter-spacing:0.04em;">${awb}</p>
    </div>
    <p style="margin:0 0 20px;">
      <a href="${trackUrl}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;background:${BRAND_RED};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
        Track on ShipMozo
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#555;">
      Questions? Reply to this email or visit <a href="https://i-robox.com" style="color:#111;font-weight:600;">i-robox.com</a>
    </p>
  </div>
  `;
}

export async function sendPickupEmail(orderId: string) {
  if (!isEmailConfigured()) {
    console.warn("[sendPickupEmail] SMTP not configured — skipped", { orderId });
    return { ok: false, skipped: true as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      awb_number: true,
      carrier: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: { select: { full_name: true } },
      shipments: { select: { tracking_number: true, carrier: true } },
    },
  });

  if (!order) {
    console.error("[sendPickupEmail] order not found", { orderId });
    return { ok: false, error: "Order not found" };
  }

  const customerEmail = order.customers?.email
    ? displayEmailForCustomer(order.customers.email)
    : null;
  if (!customerEmail) {
    console.warn("[sendPickupEmail] no deliverable customer email", { orderId });
    return { ok: false, skipped: true as const, reason: "no_email" };
  }

  const awb = order.awb_number ?? order.shipments?.tracking_number ?? "";
  if (!awb) {
    console.warn("[sendPickupEmail] missing AWB", { orderId });
    return { ok: false, skipped: true as const, reason: "no_awb" };
  }

  const carrier = order.carrier ?? order.shipments?.carrier ?? "Shipmozo";
  const customerName =
    order.addresses_orders_shipping_address_idToaddresses?.full_name?.trim() ||
    order.customers?.name?.trim() ||
    "there";
  const orderRef = formatOrderReference(order);

  const html = pickupEmailHtml({
    customerName,
    orderRef,
    carrier,
    awbNumber: awb,
  });

  const text = [
    `Hi ${customerName},`,
    "",
    `Your order #${orderRef} has been picked up and is now with ${carrier}.`,
    "",
    shipmozoTrackingBarEmailText("PICKUP_GENERATED"),
    "",
    `AWB / Tracking number: ${awb}`,
    `Track: ${TRACK_URL}`,
    "",
    "Questions? Reply to this email or visit i-robox.com",
  ].join("\n");

  await sendEmail({
    to: customerEmail,
    subject: "Your i-robox order is on its way! 🚚",
    html,
    text,
  });

  return { ok: true, sentTo: customerEmail };
}
