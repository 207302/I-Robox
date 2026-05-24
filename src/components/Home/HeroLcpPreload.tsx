import { HERO_IMAGE_SIZES } from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

/** Preload first hero slide with responsive hints (single request at viewport width). */
export default function HeroLcpPreload({ slide }: { slide?: HeroSlide }) {
  const href = slide?.image_url?.trim();
  const srcSet = slide?.image_srcSet?.trim();
  if (!href || !srcSet) return null;

  return (
    <link
      rel="preload"
      as="image"
      href={href}
      imageSrcSet={srcSet}
      imageSizes={HERO_IMAGE_SIZES}
      fetchPriority="high"
    />
  );
}
