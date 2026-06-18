import { absoluteSeoUrl, productImageAlt } from "@/lib/seo/metadata";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";

export type SitemapImageEntry = {
  url: string;
  title?: string;
  caption?: string;
};

type ImageRow = {
  url: string;
  sort_order?: number;
  alt_text?: string | null;
};

export type ProductForSitemapImages = {
  name: string;
  product_images: ImageRow[];
  product_variants?: { product_images: ImageRow[] }[];
};

function normalizeSitemapImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === PRODUCT_IMAGE_PLACEHOLDER) return null;
  return absoluteSeoUrl(trimmed);
}

/** Unique product image URLs for Google image sitemap extension (absolute HTTPS). */
export function collectProductSitemapImages(product: ProductForSitemapImages): SitemapImageEntry[] {
  const rows: ImageRow[] = [...product.product_images];
  for (const variant of product.product_variants ?? []) {
    rows.push(...variant.product_images);
  }

  const sorted = rows.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seen = new Set<string>();
  const out: SitemapImageEntry[] = [];
  const defaultTitle = productImageAlt(product.name);

  for (const row of sorted) {
    const url = normalizeSitemapImageUrl(row.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = row.alt_text?.trim() || defaultTitle;
    out.push({ url, title, caption: title });
  }

  return out;
}
