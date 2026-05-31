import { prisma } from "@/lib/prisma";
import { toEmailProductImageUrl } from "@/lib/email/abandonedCartReminder";
import type { EmailProductLine } from "@/lib/email/emailProductLines";
import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { getSiteBaseUrl } from "@/lib/siteUrl";

export async function loadOrderEmailLines(orderId: string): Promise<EmailProductLine[]> {
  const base = getSiteBaseUrl().replace(/\/$/, "");
  const shopUrl = `${base}/shop`;

  const rows = await prisma.order_items.findMany({
    where: { order_id: orderId },
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
    return {
      name: row.product_name,
      quantity: row.quantity,
      imageUrl: toEmailProductImageUrl(rawUrl, base),
      productUrl: slug ? `${base}/shop/${slug}` : shopUrl,
    };
  });
}
