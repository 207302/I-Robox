import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { formatOrderReference } from "@/lib/orders/orderNumber";
import { formatPrice } from "@/utils/formatePrice";

export const STORE_ORDER_NOTIFICATION_EMAIL = "iroboxtoys@gmail.com";

function escapeHtml(s: string) {
  return s
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
    addr.phone ? `Phone: ${addr.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Notifies the store inbox when a paid order is confirmed. */
export async function notifyStoreNewOrder(orderId: string) {
  if (!isEmailConfigured()) {
    console.warn("[store-order-notify] SMTP not configured — skipped");
    return { ok: false, skipped: true as const };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      total_amount: true,
      subtotal_amount: true,
      discount_amount: true,
      shipping_amount: true,
      status: true,
      payment_status: true,
      is_gift: true,
      gift_message: true,
      created_at: true,
      customers: { select: { email: true, name: true, phone: true } },
      order_items: {
        select: {
          product_name: true,
          quantity: true,
          unit_price: true,
          subtotal_amount: true,
        },
      },
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

  if (!order) return { ok: false, skipped: true as const };

  const orderRef = formatOrderReference(order);
  const adminUrl = `${getSiteBaseUrl()}/admin/orders/${order.id}`;
  const shipping = order.addresses_orders_shipping_address_idToaddresses;
  const customerEmail = order.customers?.email ?? "—";
  const customerName = order.customers?.name?.trim() || shipping?.full_name?.trim() || "—";
  const customerPhone = shipping?.phone?.trim() || order.customers?.phone?.trim() || "—";

  const itemsHtml = order.order_items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.product_name)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(formatPrice(Number(item.unit_price)))}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(formatPrice(Number(item.subtotal_amount)))}</td>
        </tr>`
    )
    .join("");

  const itemsText = order.order_items
    .map(
      (item) =>
        `- ${item.product_name} × ${item.quantity} @ ${formatPrice(Number(item.unit_price))} = ${formatPrice(Number(item.subtotal_amount))}`
    )
    .join("\n");

  const giftBlock =
    order.is_gift && order.gift_message?.trim()
      ? `<p style="margin:1em 0 0"><strong>Gift message:</strong> ${escapeHtml(order.gift_message.trim())}</p>`
      : "";

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;color:#111">
    <h2 style="margin:0 0 0.5em">New order received</h2>
    <p style="margin:0 0 1em">A customer order was confirmed and is ready to fulfil.</p>
    <p style="margin:0.35em 0"><strong>Order:</strong> ${escapeHtml(orderRef)}</p>
    <p style="margin:0.35em 0"><strong>Status:</strong> ${escapeHtml(String(order.status))} · ${escapeHtml(String(order.payment_status))}</p>
    <p style="margin:0.35em 0"><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
    <p style="margin:0.35em 0"><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
    <p style="margin:0.35em 0"><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
    ${
      shipping
        ? `<h3 style="margin:1.25em 0 0.35em;font-size:1.05em">Ship to</h3>
    <pre style="margin:0;font-family:inherit;white-space:pre-wrap">${escapeHtml(formatAddress(shipping))}</pre>`
        : ""
    }
    <h3 style="margin:1.25em 0 0.35em;font-size:1.05em">Items</h3>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;font-size:14px">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d5db">Product</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #d1d5db">Qty</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #d1d5db">Unit</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #d1d5db">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p style="margin:1em 0 0"><strong>Subtotal:</strong> ${escapeHtml(formatPrice(Number(order.subtotal_amount)))}</p>
    <p style="margin:0.35em 0"><strong>Discount:</strong> ${escapeHtml(formatPrice(Number(order.discount_amount)))}</p>
    <p style="margin:0.35em 0"><strong>Shipping:</strong> ${escapeHtml(formatPrice(Number(order.shipping_amount)))}</p>
    <p style="margin:0.35em 0"><strong>Total:</strong> ${escapeHtml(formatPrice(Number(order.total_amount)))}</p>
    ${giftBlock}
    <p style="margin:1.5em 0 0">
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">View in admin</a>
    </p>
  </div>`;

  const text = [
    "New order received",
    "",
    `Order: ${orderRef}`,
    `Status: ${order.status} · ${order.payment_status}`,
    `Customer: ${customerName}`,
    `Email: ${customerEmail}`,
    `Phone: ${customerPhone}`,
    shipping ? `\nShip to:\n${formatAddress(shipping)}` : "",
    "",
    "Items:",
    itemsText,
    "",
    `Subtotal: ${formatPrice(Number(order.subtotal_amount))}`,
    `Discount: ${formatPrice(Number(order.discount_amount))}`,
    `Shipping: ${formatPrice(Number(order.shipping_amount))}`,
    `Total: ${formatPrice(Number(order.total_amount))}`,
    order.is_gift && order.gift_message?.trim() ? `\nGift message: ${order.gift_message.trim()}` : "",
    "",
    `Admin: ${adminUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  await sendEmail({
    to: STORE_ORDER_NOTIFICATION_EMAIL,
    subject: `New order — ${formatPrice(Number(order.total_amount))} | ${orderRef}`,
    html,
    text,
  });

  return { ok: true, skipped: false as const };
}
