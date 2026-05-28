import {
  cloudinaryHeroMobileUrl,
  cloudinaryHeroSlideUrl,
  cloudinaryHeroSourceUrl,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";

export { isCloudinaryDeliveryUrl };

/** Default sizes hint — per-breakpoint sizes are set on each hero Image in HeroSlideImage. */
export const HERO_IMAGE_SIZES =
  "(max-width: 1023px) 100vw, 1440px";

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
  const resolvedSrc = isCloudinaryDeliveryUrl(src)
    ? cloudinaryHeroSlideUrl(src, isLcp)
    : src;
  const mobileSrc = isCloudinaryDeliveryUrl(src)
    ? cloudinaryHeroMobileUrl(src, isLcp)
    : src;
  const shared = {
    src: resolvedSrc,
    mobileSrc,
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
    loading: "lazy" as const,
    fetchPriority: "auto" as const,
  };
}
