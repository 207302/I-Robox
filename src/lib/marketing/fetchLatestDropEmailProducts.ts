import { prisma } from "@/lib/prisma";
import { toEmailProductImageUrl } from "@/lib/email/abandonedCartReminder";
import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { formatPrice } from "@/utils/formatePrice";

export type LatestDropEmailProduct = {
  name: string;
  imageUrl: string;
  productUrl: string;
  priceLabel: string;
};

const LATEST_DROP_PRODUCT_COUNT = 5;

export async function fetchLatestDropEmailProducts(
  limit = LATEST_DROP_PRODUCT_COUNT
): Promise<LatestDropEmailProduct[]> {
  const products = await prisma.products.findMany({
    where: { is_active: true },
    orderBy: { updated_at: "desc" },
    take: Math.max(1, Math.min(limit, 10)),
    select: {
      name: true,
      slug: true,
      base_price: true,
      discounted_price: true,
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
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  const base = getSiteBaseUrl().replace(/\/$/, "");
  const shopUrl = `${base}/shop`;

  return products.map((product) => {
    const imageRaw = getProductCardImageUrl({
      product_images: product.product_images,
      productVariants: product.product_variants.map((v) => ({
        isDefault: v.is_default,
        image: v.product_images[0]?.url ?? "",
      })),
    });
    const discounted = product.discounted_price != null ? Number(product.discounted_price) : null;
    const basePrice = Number(product.base_price);
    const price = discounted != null && discounted > 0 && discounted < basePrice ? discounted : basePrice;

    return {
      name: product.name,
      imageUrl: toEmailProductImageUrl(imageRaw, base),
      productUrl: product.slug ? `${base}/shop/${product.slug}` : shopUrl,
      priceLabel: formatPrice(price),
    };
  });
}

export function latestDropShopUrl(): string {
  return `${getSiteBaseUrl().replace(/\/$/, "")}/shop`;
}
