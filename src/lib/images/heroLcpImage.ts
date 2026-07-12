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

function deliverHeroUrl(src: string, isLcp: boolean, variant: "desktop" | "mobile") {
  if (!isCloudinaryDeliveryUrl(src)) return src;
  return variant === "mobile"
    ? cloudinaryHeroMobileUrl(src, isLcp)
    : cloudinaryHeroSlideUrl(src, isLcp);
}

export function heroSlideImageProps(
  desktopSrc: string,
  isLcp: boolean,
  mobileSrcOverride?: string | null
) {
  const desktop = desktopSrc.trim();
  const mobileRaw = mobileSrcOverride?.trim() || desktop;
  const shared = {
    src: deliverHeroUrl(desktop, isLcp, "desktop"),
    mobileSrc: deliverHeroUrl(mobileRaw, isLcp, "mobile"),
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
