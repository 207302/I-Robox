import { cloudinaryHeroSrcSet, isCloudinaryDeliveryUrl } from "@/lib/images/cloudinaryDeliver";

export { isCloudinaryDeliveryUrl };

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

export function heroSlideImageProps(
  src: string,
  srcSet: string | undefined,
  isLcp: boolean
) {
  const unoptimized = isCloudinaryDeliveryUrl(src);
  const shared = {
    src,
    ...(srcSet ? { srcSet } : {}),
    unoptimized,
    sizes: "100vw",
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
  };
}
