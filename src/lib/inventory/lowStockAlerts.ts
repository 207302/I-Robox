import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { EMAIL_FONT_FAMILY } from "@/lib/email/emailTypography";

async function adminRecipients(): Promise<string[]> {
  const rows = await prisma.admin_users.findMany({
    where: { is_active: true },
    select: { email: true },
  });
  return rows.map((r) => r.email.trim()).filter(Boolean);
}

/**
 * Sends deduplicated low-stock alerts for product-level inventory rows.
 * - Alert when available <= threshold and no prior alert marker.
 * - Reset marker when available > threshold to allow future alerts.
 */
export async function syncLowStockAlertsByProductIds(productIds: string[]) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return { alerted: 0, reset: 0, skipped: true };

  const rows = await prisma.inventory.findMany({
    where: { product_id: { in: ids }, product_variant_id: null },
    select: {
      id: true,
      product_id: true,
      available_quantity: true,
      low_stock_threshold: true,
      low_stock_alert_sent_at: true,
      products: { select: { name: true, slug: true } },
    },
  });

  const toReset = rows.filter(
    (r) => r.low_stock_alert_sent_at != null && r.available_quantity > r.low_stock_threshold
  );
  if (toReset.length > 0) {
    await prisma.inventory.updateMany({
      where: { id: { in: toReset.map((r) => r.id) } },
      data: { low_stock_alert_sent_at: null },
    });
  }

  const toAlert = rows.filter(
    (r) => r.low_stock_alert_sent_at == null && r.available_quantity <= r.low_stock_threshold
  );
  if (toAlert.length === 0) {
    return { alerted: 0, reset: toReset.length, skipped: false };
  }

  const recipients = await adminRecipients();
  if (!isEmailConfigured() || recipients.length === 0) {
    return { alerted: 0, reset: toReset.length, skipped: true };
  }

  const lines = toAlert
    .map(
      (r) =>
        `<li><b>${(r.products?.name ?? r.product_id).replace(/</g, "&lt;")}</b> ` +
        `(slug: ${(r.products?.slug ?? "-").replace(/</g, "&lt;")}) — ` +
        `available: <b>${r.available_quantity}</b>, threshold: ${r.low_stock_threshold}</li>`
    )
    .join("");

  await sendEmail({
    to: recipients.join(","),
    subject: `Low stock alert (${toAlert.length}) | i-Robox`,
    html: `
      <div style="font-family:${EMAIL_FONT_FAMILY};line-height:1.55">
        <h2>Low stock alert</h2>
        <p>The following products are at or below threshold:</p>
        <ul>${lines}</ul>
      </div>
    `,
    text: [
      "Low stock alert:",
      ...toAlert.map(
        (r) =>
          `${r.products?.name ?? r.product_id} (${r.products?.slug ?? "-"}) — available ${r.available_quantity}, threshold ${r.low_stock_threshold}`
      ),
    ].join("\n"),
  });

  await prisma.inventory.updateMany({
    where: { id: { in: toAlert.map((r) => r.id) }, low_stock_alert_sent_at: null },
    data: { low_stock_alert_sent_at: new Date() },
  });

  return { alerted: toAlert.length, reset: toReset.length, skipped: false };
}
