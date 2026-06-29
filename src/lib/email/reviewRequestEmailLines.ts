import { prisma } from "@/lib/prisma";
import { toEmailProductImageUrl } from "@/lib/email/abandonedCartReminder";
import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { getSiteBaseUrl } from "@/lib/siteUrl";

export type ReviewRequestProductLine = {
  name: string;
  quantity: number;
  imageUrl: string;
  productUrl: string;
  reviewUrl: string;
};

export async function loadReviewRequestLines(
  orderId: string
): Promise<ReviewRequestProductLine[]> {
  const base = getSiteBaseUrl().replace(/\/$/, "");
  const shopUrl = `${base}/shop`;

  const rows = await prisma.order_items.findMany({
    where: {
      order_id: orderId,
      reviews: { none: {} },
    },
    orderBy: { created_at: "asc" },
    select: {
      product_name: true,
      quantity: true,
      product_variant_id: true,
      products: {
        select: {
          slug: true,
          product_images: {
            where: { product_variant_id: null },
            orderBy: { sort_order: "asc" },
            select: { url: true, sort_order: true },
          },
          product_variants: {
            select: {
              id: true,
              is_default: true,
              product_images: {
                orderBy: { sort_order: "asc" },
                select: { url: true, sort_order: true },
              },
            },
          },
        },
      },
      product_variants: {
        select: {
          product_images: {
            orderBy: { sort_order: "asc" },
            select: { url: true, sort_order: true },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const variantUrl = row.product_variants?.product_images[0]?.url?.trim() ?? "";
    let rawUrl = variantUrl;
    if (!rawUrl && row.products) {
      rawUrl = getProductCardImageUrl({
        product_images: row.products.product_images,
        productVariants: row.products.product_variants.map((v) => ({
          isDefault: v.is_default,
          image: v.product_images[0]?.url ?? "",
        })),
      }).trim();
    }

    const slug = row.products?.slug;
    const productUrl = slug ? `${base}/shop/${slug}` : shopUrl;
    return {
      name: row.product_name,
      quantity: row.quantity,
      imageUrl: toEmailProductImageUrl(rawUrl, base),
      productUrl,
      reviewUrl: productUrl,
    };
  });
}

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

export function reviewRequestProductLinesTableHtml(lines: ReviewRequestProductLine[]): string {
  const items = lines.slice(0, 8);
  if (items.length === 0) return "";

  const brandRed = "#E63946";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0 20px;border-collapse:collapse;max-width:520px">
  ${items
    .map((line) => {
      const safeName = escapeHtmlText(line.name);
      const safeImg = escapeHtmlAttr(line.imageUrl);
      const safeProductUrl = escapeHtmlAttr(line.productUrl);
      const safeReviewUrl = escapeHtmlAttr(line.reviewUrl);
      const qty = Math.max(1, Math.floor(line.quantity));
      return `<tr>
    <td style="padding:10px 14px 10px 0;vertical-align:middle;width:76px">
      <a href="${safeProductUrl}" style="text-decoration:none">
        <img src="${safeImg}" alt="${escapeHtmlAttr(line.name)}" width="72" height="72" border="0" style="display:block;width:72px;height:72px;max-width:72px;border-radius:8px;border:1px solid #e5e7eb;background-color:#f9fafb;object-fit:cover" />
      </a>
    </td>
    <td style="padding:10px 0;vertical-align:middle">
      <a href="${safeProductUrl}" style="color:#111;text-decoration:none;font-weight:600">${safeName}</a>
      <div style="margin:4px 0 8px;font-size:14px;color:#555">Qty ${qty}</div>
      <a href="${safeReviewUrl}" style="display:inline-block;background:${brandRed};color:#fff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600">Leave a review</a>
    </td>
  </tr>`;
    })
    .join("")}
</table>`;
}

export function reviewRequestProductLinesText(lines: ReviewRequestProductLine[]): string[] {
  return lines.map(
    (line) =>
      `${line.name} × ${Math.max(1, Math.floor(line.quantity))} — Leave a review: ${line.reviewUrl}`
  );
}
