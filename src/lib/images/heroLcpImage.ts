import {
  cloudinaryHeroSourceUrl,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";

export { isCloudinaryDeliveryUrl };

/** Matches hero `fill` layout — next/image picks srcset width from this + deviceSizes. */
export const HERO_IMAGE_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, (max-width: 1280px) 1280px, 1440px";

/** Preload href for shop/LCP helpers — ceiling URL; next/image handles responsive widths. */
export function heroLcpPreloadHref(rawUrl: string): string | null {
  const t = rawUrl?.trim();
  if (!t || t === "/images/404.svg") return null;
  if (isCloudinaryDeliveryUrl(t)) {
    return cloudinaryHeroSourceUrl(t);
  }
  return t;
}

export function heroSlideImageProps(src: string, isLcp: boolean) {
  const shared = {
    src,
    sizes: HERO_IMAGE_SIZES,
  };

  if (isLcp) {
    return {
      ...shared,
      priority: true as const,
      fetchPriority: "high" as const,
      loading: "eager" as const,
    };
  }
  return {
    ...shared,
    priority: false as const,
    loading: "lazy" as const,
    fetchPriority: "low" as const,
  };
}
