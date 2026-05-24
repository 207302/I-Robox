import {
  cloudinaryHeroDeliverUrlForLayout,
  cloudinaryHeroSrcSet,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";

export { isCloudinaryDeliveryUrl };

/** Matches hero `fill` layout — lets the browser pick the correct srcSet width (not 1536px on mobile). */
export const HERO_IMAGE_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 1536px";

export function heroLcpPreloadBundle(
  rawUrl: string
): { href: string; srcSet?: string } | null {
  const t = rawUrl?.trim();
  if (!t || t === "/images/404.svg") return null;
  if (isCloudinaryDeliveryUrl(t)) {
    const { src, srcSet } = cloudinaryHeroSrcSet(t);
    return { href: src, srcSet };
  }
  return { href: t };
}

/** Single-URL preload for LCP — avoids firing every srcSet width at once (Cloudinary 429 burst). */
export function heroLcpPreloadHref(rawUrl: string): string | null {
  const t = rawUrl?.trim();
  if (!t || t === "/images/404.svg") return null;
  if (isCloudinaryDeliveryUrl(t)) {
    return cloudinaryHeroDeliverUrlForLayout(t, 640);
  }
  return t;
}

export function heroSlideImageProps(
  src: string,
  srcSet: string | undefined,
  isLcp: boolean
) {
  const unoptimized = isCloudinaryDeliveryUrl(src);
  const shared = {
    src,
    unoptimized,
    sizes: HERO_IMAGE_SIZES,
  };

  if (isLcp) {
    return {
      ...shared,
      ...(srcSet ? { srcSet } : {}),
      priority: true as const,
      fetchPriority: "high" as const,
      loading: "eager" as const,
    };
  }
  return {
    ...shared,
    ...(srcSet ? { srcSet } : {}),
    loading: "lazy" as const,
  };
}
