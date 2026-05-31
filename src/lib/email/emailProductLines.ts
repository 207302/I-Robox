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

export type EmailProductLine = {
  name: string;
  quantity: number;
  imageUrl: string;
  productUrl: string;
};

/** Product rows with thumbnail for transactional emails (orders, cart reminders). */
export function emailProductLinesTableHtml(lines: EmailProductLine[]): string {
  const items = lines.slice(0, 8);
  if (items.length === 0) return "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0 20px;border-collapse:collapse;max-width:520px">
  ${items
    .map((line) => {
      const safeName = escapeHtmlText(line.name);
      const safeImg = escapeHtmlAttr(line.imageUrl);
      const safeProductUrl = escapeHtmlAttr(line.productUrl);
      const qty = Math.max(1, Math.floor(line.quantity));
      return `<tr>
    <td style="padding:10px 14px 10px 0;vertical-align:middle;width:76px">
      <a href="${safeProductUrl}" style="text-decoration:none">
        <img src="${safeImg}" alt="${escapeHtmlAttr(line.name)}" width="72" height="72" border="0" style="display:block;width:72px;height:72px;max-width:72px;border-radius:8px;border:1px solid #e5e7eb;background-color:#f9fafb;object-fit:cover" />
      </a>
    </td>
    <td style="padding:10px 0;vertical-align:middle">
      <a href="${safeProductUrl}" style="color:#111;text-decoration:none;font-weight:600">${safeName}</a>
      <div style="margin:4px 0 0;font-size:14px;color:#555">Qty ${qty}</div>
    </td>
  </tr>`;
    })
    .join("")}
</table>`;
}

export function emailProductLinesText(lines: EmailProductLine[]): string[] {
  return lines.map((l) => `${l.name} × ${Math.max(1, Math.floor(l.quantity))}`);
}
