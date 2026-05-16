import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";

export { PRODUCT_IMAGE_PLACEHOLDER };

type ProductImageSource = {
  image?: string;
  product_images?: { url: string; sort_order?: number }[];
  productVariants: {
    image?: string;
    images?: string[];
    isDefault?: boolean;
    color?: string;
    name?: string;
  }[];
};

/** Card/thumbnail URL — same rules as `ProductItem` (default variant, then any variant image, then gallery). */
export function getProductCardImageUrl(item: ProductImageSource): string {
  const gallery = getProductGalleryImages(item);
  return gallery[0] === PRODUCT_IMAGE_PLACEHOLDER ? "" : gallery[0];
}

/** Deduped gallery URLs for quick view / fullscreen preview (product + variant images). */
export function getProductGalleryImages(item: ProductImageSource): string[] {
  const urls: string[] = [];
  const add = (url?: string | null) => {
    const t = url?.trim();
    if (t && !urls.includes(t)) urls.push(t);
  };

  add(item.image);

  const sortedProductImages = (item.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const img of sortedProductImages) {
    add(img.url);
  }

  for (const variant of item.productVariants ?? []) {
    for (const url of variant.images ?? []) {
      add(url);
    }
    add(variant.image);
  }

  return urls.length > 0 ? urls : [PRODUCT_IMAGE_PLACEHOLDER];
}

/** Index into `getProductGalleryImages` for the default / first available variant image. */
export function getDefaultGalleryIndex(
  item: ProductImageSource,
  gallery: string[]
): number {
  const defaultVariant = item.productVariants?.find((v) => v.isDefault);
  const preferred =
    defaultVariant?.image ||
    item.productVariants?.find((v) => Boolean(v.image?.trim()))?.image ||
    item.image;
  if (preferred) {
    const idx = gallery.indexOf(preferred);
    if (idx >= 0) return idx;
  }
  return 0;
}
