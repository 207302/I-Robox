import type { LatestDropEmailProduct } from "@/lib/marketing/fetchLatestDropEmailProducts";

function escapeHtmlAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtmlText(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function latestDropProductsTableHtml(products: LatestDropEmailProduct[]): string {
  if (products.length === 0) return "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 24px;border-collapse:collapse;max-width:520px">
  ${products
    .map((product) => {
      const safeName = escapeHtmlText(product.name);
      const safeImg = escapeHtmlAttr(product.imageUrl);
      const safeProductUrl = escapeHtmlAttr(product.productUrl);
      const safePrice = escapeHtmlText(product.priceLabel);
      return `<tr>
    <td style="padding:10px 14px 10px 0;vertical-align:middle;width:76px">
      <a href="${safeProductUrl}" style="text-decoration:none">
        <img src="${safeImg}" alt="${escapeHtmlAttr(product.name)}" width="72" height="72" border="0" style="display:block;width:72px;height:72px;max-width:72px;border-radius:8px;border:1px solid #e5e7eb;background-color:#f9fafb;object-fit:cover" />
      </a>
    </td>
    <td style="padding:10px 0;vertical-align:middle">
      <a href="${safeProductUrl}" style="color:#111;text-decoration:none;font-weight:600">${safeName}</a>
      <div style="margin:4px 0 0;font-size:14px;color:#555">${safePrice}</div>
    </td>
  </tr>`;
    })
    .join("")}
</table>`;
}

export function latestDropBroadcastEmailHtml(input: {
  shopUrl: string;
  recipientName?: string;
  products: LatestDropEmailProduct[];
}) {
  const safeShopUrl = escapeHtmlAttr(input.shopUrl);
  const greeting = input.recipientName?.trim()
    ? `Hi ${escapeHtmlText(input.recipientName.trim())},`
    : "Hi there,";
  const productsHtml = latestDropProductsTableHtml(input.products);

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;color:#111">
    <h2 style="margin:0 0 0.5em">Fresh arrivals at i-Robox</h2>
    <p style="margin:0 0 1em">${greeting} here are our latest drops — hand-picked new products just added to the shop.</p>
    ${productsHtml}
    <p style="margin:0 0 1em">Browse the full collection and grab your favourites before they sell out.</p>
    <p style="margin:0">
      <a href="${safeShopUrl}" style="display:inline-block;background:#E63946;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Shop new arrivals</a>
    </p>
    <p style="margin:1.25em 0 0;font-size:13px;color:#666">You received this because you signed up for latest-drop updates on i-robox.com.</p>
  </div>`;
}

export function latestDropBroadcastEmailText(input: {
  shopUrl: string;
  recipientName?: string;
  products: LatestDropEmailProduct[];
}) {
  const greeting = input.recipientName?.trim() ? `Hi ${input.recipientName.trim()},` : "Hi there,";
  const lines = [
    greeting,
    "",
    "Fresh arrivals at i-Robox — our latest drops:",
    "",
    ...input.products.map((p) => `- ${p.name} — ${p.priceLabel}\n  ${p.productUrl}`),
    "",
    `Shop all new arrivals: ${input.shopUrl}`,
    "",
    "You received this because you signed up for latest-drop updates on i-robox.com.",
  ];
  return lines.join("\n");
}

export const LATEST_DROP_BROADCAST_SUBJECT = "Fresh drops at i-Robox — see what's new";
