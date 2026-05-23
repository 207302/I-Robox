import { cloudinaryProductCardUrl } from "@/lib/images/cloudinaryDeliver";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";

/** Cloudinary transform for LCP preload — must match `cloudinaryProductCardUrl(..., 380)`. */
export function shopLcpPreloadHref(src?: string | null): string | null {
  const resolved = resolveProductImageSrc(src);
  if (!resolved.startsWith("http")) return null;

  if (resolved.includes("res.cloudinary.com") && resolved.includes("/image/upload/")) {
    return cloudinaryProductCardUrl(resolved, 380);
  }

  return resolved;
}
