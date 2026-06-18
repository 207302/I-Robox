import { HERO_IMAGE_SIZES, heroLcpPreloadHref } from "@/lib/images/heroLcpImage";
import { resolvePublicImageUrl } from "@/lib/lcp/resolveImageUrl";
import { productGalleryLcpPreloadHref } from "@/lib/shop/productGalleryLcp";
import { getImageProps } from "next/image";

type Props = {
  /** Raw or absolute image URL (pre-transform Cloudinary URL preferred). */
  imageUrl: string;
  /** Hero banners vs product gallery — Cloudinary preload transform differs. */
  variant?: "hero" | "product";
  /** Fallback when URL is local — must match `next/image` on the page. */
  sizes?: string;
  width?: number;
  height?: number;
  quality?: number;
};

/**
 * Preload the true LCP image in document head — direct Cloudinary URL when possible
 * (same URL as server hero `Image`, not `/_next/image`).
 */
export default function LcpImagePrelink({
  imageUrl,
  variant = "hero",
  sizes = HERO_IMAGE_SIZES,
  width = 1920,
  height = 711,
  quality = 90,
}: Props) {
  const cloudinaryHref =
    variant === "product"
      ? productGalleryLcpPreloadHref(imageUrl)
      : heroLcpPreloadHref(imageUrl);
  if (cloudinaryHref) {
    return (
      <link
        rel="preload"
        as="image"
        href={cloudinaryHref}
        fetchPriority="high"
      />
    );
  }

  const resolved = resolvePublicImageUrl(imageUrl);
  if (!resolved) return null;

  try {
    const { props } = getImageProps({
      src: resolved,
      alt: "",
      width,
      height,
      sizes,
      quality,
    });
    if (!props.src) return null;
    return (
      <link
        rel="preload"
        as="image"
        href={props.src}
        imageSrcSet={props.srcSet || undefined}
        imageSizes={props.sizes || sizes}
        fetchPriority="high"
      />
    );
  } catch {
    return null;
  }
}
