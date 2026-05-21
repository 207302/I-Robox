import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";

/** Cloudinary transform for LCP preload (smaller than full-size original). */
export function shopLcpPreloadHref(src?: string | null): string | null {
  const resolved = resolveProductImageSrc(src);
  if (!resolved.startsWith("http")) return null;

  if (resolved.includes("res.cloudinary.com") && resolved.includes("/upload/")) {
    return resolved.replace("/upload/", "/upload/f_auto,q_80,w_640/");
  }

  return resolved;
}
