import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { PRODUCT_IMAGE_REMOTE_FALLBACK } from "@/lib/shop/productImagePlaceholder";
import { resolveAbsoluteUrl } from "@/lib/siteUrl";

type ProductImageRow = { url: string; sort_order?: number };

type CartLineImageProduct = {
  product_images: ProductImageRow[];
  product_variants: {
    is_default: boolean;
    product_images: ProductImageRow[];
  }[];
};

function firstImageUrl(images: ProductImageRow[]): string {
  const sorted = images.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return sorted[0]?.url?.trim() ?? "";
}

/** Prefer the cart line’s variant image, then catalog card rules. */
export function resolveCartLineImagePath(
  product: CartLineImageProduct | null | undefined,
  variant: { product_images: ProductImageRow[] } | null | undefined
): string {
  const variantUrl = firstImageUrl(variant?.product_images ?? []);
  if (variantUrl) return variantUrl;

  if (!product) return "";
  return getProductCardImageUrl({
    product_images: product.product_images,
    productVariants: product.product_variants.map((v) => ({
      isDefault: v.is_default,
      image: firstImageUrl(v.product_images),
    })),
  });
}

export function emailImageSrc(pathOrUrl: string, siteBase: string): string {
  const t = pathOrUrl.trim();
  if (!t) return PRODUCT_IMAGE_REMOTE_FALLBACK;
  return resolveAbsoluteUrl(t, siteBase) || PRODUCT_IMAGE_REMOTE_FALLBACK;
}
