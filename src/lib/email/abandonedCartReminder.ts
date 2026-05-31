import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { PRODUCT_IMAGE_REMOTE_FALLBACK } from "@/lib/shop/productImagePlaceholder";
import { getSiteBaseUrl, resolveAbsoluteUrl } from "@/lib/siteUrl";
import type { EmailProductLine } from "@/lib/email/emailProductLines";

export type AbandonedCartReminderLine = EmailProductLine;

type ImageRow = { url: string; sort_order: number };

/** Prisma select fragment for cart lines in the abandoned-cart cron. */
export const abandonedCartItemSelect = {
  quantity: true,
  product_variant_id: true,
  products: {
    select: {
      name: true,
      slug: true,
      product_images: {
        where: { product_variant_id: null },
        orderBy: { sort_order: "asc" as const },
        select: { url: true, sort_order: true },
      },
      product_variants: {
        select: {
          id: true,
          is_default: true,
          product_images: {
            orderBy: { sort_order: "asc" as const },
            select: { url: true, sort_order: true },
          },
        },
      },
    },
  },
  product_variants: {
    select: {
      product_images: {
        orderBy: { sort_order: "asc" as const },
        select: { url: true, sort_order: true },
      },
    },
  },
} as const;

export type AbandonedCartItemRow = {
  quantity: number;
  product_variant_id: string | null;
  products: {
    name: string;
    slug: string;
    product_images: ImageRow[];
    product_variants: {
      id: string;
      is_default: boolean;
      product_images: ImageRow[];
    }[];
  } | null;
  product_variants: {
    product_images: ImageRow[];
  } | null;
};

function firstSortedImageUrl(images: ImageRow[]): string {
  return images[0]?.url?.trim() ?? "";
}

function resolveRawImageUrl(item: AbandonedCartItemRow): string {
  const lineVariantUrl = firstSortedImageUrl(item.product_variants?.product_images ?? []);
  if (lineVariantUrl) return lineVariantUrl;

  const product = item.products;
  if (!product) return "";

  const cardUrl = getProductCardImageUrl({
    product_images: product.product_images,
    productVariants: product.product_variants.map((v) => ({
      isDefault: v.is_default,
      image: firstSortedImageUrl(v.product_images),
    })),
  });

  return cardUrl.trim();
}

/** Smaller Cloudinary delivery for email clients (public HTTPS URL). */
export function cloudinaryEmailThumbUrl(url: string, size = 144): string {
  const t = url.trim();
  const marker = "/image/upload/";
  const idx = t.indexOf(marker);
  if (idx === -1) return t;
  const prefix = t.slice(0, idx + marker.length);
  const suffix = t.slice(idx + marker.length);
  if (/^w_\d+,/.test(suffix)) return t;
  return `${prefix}w_${size},h_${size},c_fill,q_auto,f_auto/${suffix}`;
}

export function toEmailProductImageUrl(rawUrl: string, siteBase?: string): string {
  const base = (siteBase ?? getSiteBaseUrl()).replace(/\/$/, "");
  const trimmed = rawUrl.trim();
  if (!trimmed) return PRODUCT_IMAGE_REMOTE_FALLBACK;

  let absolute = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    absolute = resolveAbsoluteUrl(trimmed, base);
    if (!absolute) return PRODUCT_IMAGE_REMOTE_FALLBACK;
  }

  if (absolute.includes("res.cloudinary.com") && absolute.includes("/image/upload/")) {
    return cloudinaryEmailThumbUrl(absolute);
  }

  return absolute;
}

export function buildAbandonedCartReminderLines(
  items: AbandonedCartItemRow[],
  siteBase?: string
): AbandonedCartReminderLine[] {
  const base = (siteBase ?? getSiteBaseUrl()).replace(/\/$/, "");
  const shopUrl = `${base}/shop`;

  return items.slice(0, 6).map((ci) => {
    const name = ci.products?.name ?? "Item";
    const slug = ci.products?.slug;
    const imageUrl = toEmailProductImageUrl(resolveRawImageUrl(ci), base);
    return {
      name,
      quantity: ci.quantity,
      imageUrl,
      productUrl: slug ? `${base}/shop/${slug}` : shopUrl,
    };
  });
}

export function abandonedCartReminderTextLines(lines: AbandonedCartReminderLine[]): string[] {
  return lines.map((l) => `${l.name} × ${l.quantity}`);
}
