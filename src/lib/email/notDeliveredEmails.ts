import { prisma } from "@/lib/prisma";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { isEmailConfigured, orderEmailTemplate, sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { STORE_ORDER_NOTIFICATION_EMAIL } from "@/lib/orders/storeOrderNotifications";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { getSiteMarketingSettings } from "@/lib/queries/marketing";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAddress(addr: {
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}) {
  return [
    addr.full_name,
    addr.line1,
    addr.line2,
    `${addr.city}, ${addr.state} ${addr.postal_code}`,
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function sendNotDeliveredCustomerEmail(orderId: string) {
  if (!isEmailConfigured()) {
    return { ok: false as const, skipped: true as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: {
        select: { full_name: true },
      },
    },
  });
  if (!order) return { ok: false as const, skipped: true as const };

  const rawEmail = order.customers?.email ?? null;
  if (!rawEmail || isSyntheticPhoneSignupEmail(rawEmail)) {
    return { ok: false as const, skipped: true as const };
  }

  const to = displayEmailForCustomer(rawEmail);
  if (!to) return { ok: false as const, skipped: true as const };

  const orderRef = formatOrderReference(order);
  const customerName =
    order.addresses_orders_shipping_address_idToaddresses?.full_name?.trim() ||
    order.customers?.name?.trim() ||
    "there";
  const supportUrl = `${getSiteBaseUrl()}/contact`;
  const marketing = await getSiteMarketingSettings();
  const supportPhone = marketing?.contact_phone?.trim() || null;

  const contactDetails = [
    `Email: ${STORE_ORDER_NOTIFICATION_EMAIL}`,
    supportPhone ? `Phone: ${supportPhone}` : null,
    `Contact form: ${supportUrl}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const message = [
    `Hi ${customerName},`,
    `Our courier partner was unable to deliver your order ${orderRef}.`,
    "Please confirm your delivery address is correct, or contact our support team to arrange re-delivery.",
    contactDetails,
  ].join(" ");

  await sendEmail({
    to,
    subject: "Delivery Attempt Failed — Action Required",
    html: orderEmailTemplate({
      heading: "Delivery attempt failed",
      message,
      orderId: orderRef,
    }),
    text: `Delivery Attempt Failed — Action Required\n\n${message}\n\nOrder: ${orderRef}`,
  });

  return { ok: true as const };
}

export async function sendNotDeliveredStoreAlert(orderId: string) {
  if (!isEmailConfigured()) {
    return { ok: false as const, skipped: true as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      awb_number: true,
      customers: { select: { email: true, name: true, phone: true } },
      addresses_orders_shipping_address_idToaddresses: {
        select: {
          full_name: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
        },
      },
    },
  });
  if (!order) return { ok: false as const, skipped: true as const };

  const orderRef = formatOrderReference(order);
  const shipping = order.addresses_orders_shipping_address_idToaddresses;
  const customerName = shipping?.full_name?.trim() || order.customers?.name?.trim() || "—";
  const customerPhone = shipping?.phone?.trim() || order.customers?.phone?.trim() || "—";
  const deliveryAddress = shipping ? formatAddress(shipping) : "—";
  const awb = order.awb_number?.trim() || "—";
  const adminUrl = `${getSiteBaseUrl()}/admin/orders/${order.id}`;

  const html = `
  <div style="font-family:${EMAIL_FONT_FAMILY};line-height:1.55;color:#111">
    <h2 style="margin:0 0 0.5em">ND Alert — shipment not delivered</h2>
    <p style="margin:0.35em 0"><strong>Order ID:</strong> ${escapeHtml(orderRef)}</p>
    <p style="margin:0.35em 0"><strong>Customer name:</strong> ${escapeHtml(customerName)}</p>
    <p style="margin:0.35em 0"><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
    <p style="margin:0.35em 0"><strong>Delivery address:</strong> ${escapeHtml(deliveryAddress)}</p>
    <p style="margin:0.35em 0"><strong>AWB number:</strong> ${escapeHtml(awb)}</p>
    <p style="margin:1.25em 0 0">
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">View order in admin</a>
    </p>
  </div>`;

  const text = [
    `ND Alert — Order #${orderRef}`,
    "",
    `Order ID: ${orderRef}`,
    `Customer name: ${customerName}`,
    `Phone: ${customerPhone}`,
    `Delivery address: ${deliveryAddress}`,
    `AWB number: ${awb}`,
    "",
    `Admin: ${adminUrl}`,
  ].join("\n");

  await sendEmail({
    to: STORE_ORDER_NOTIFICATION_EMAIL,
    subject: `ND Alert — Order #${orderRef}`,
    html,
    text,
  });

  return { ok: true as const };
}
