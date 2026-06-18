import {
  cloudinaryDeliverUrl,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";

/** Mobile PDP gallery LCP — matches `sizes="(max-width: 1024px) 100vw, 50vw"` at ~2× DPR. */
const PRODUCT_GALLERY_LCP_WIDTH = 828;

/** Preload href for product detail gallery — object-contain, not hero crop. */
export function productGalleryLcpPreloadHref(src?: string | null): string | null {
  const resolved = resolveProductImageSrc(src);
  if (!resolved.startsWith("http")) return null;

  if (isCloudinaryDeliveryUrl(resolved)) {
    return cloudinaryDeliverUrl(resolved, {
      width: PRODUCT_GALLERY_LCP_WIDTH,
      quality: "auto:good",
      crop: "limit",
    });
  }

  return resolved;
}
