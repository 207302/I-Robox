/** Local static fallback (exists in /public). */
export const PRODUCT_IMAGE_PLACEHOLDER = "/images/404.svg";

/** Remote fallback when local asset or CDN URL fails. */
export const PRODUCT_IMAGE_REMOTE_FALLBACK =
  "https://placehold.co/400x400/png?text=No+Image";

export function resolveProductImageSrc(src?: string | null): string {
  const trimmed = src?.trim();
  if (!trimmed || trimmed === "/images/products/placeholder.png") {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }
  return trimmed;
}
