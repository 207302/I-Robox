import { heroLcpPreloadBundle } from "@/lib/images/heroLcpImage";
import { resolvePublicImageUrl } from "@/lib/lcp/resolveImageUrl";
import { getImageProps } from "next/image";

type Props = {
  /** Raw or absolute image URL (pre-transform Cloudinary URL preferred). */
  imageUrl: string;
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
  sizes = "100vw",
  width = 2560,
  height = 948,
  quality = 90,
}: Props) {
  const cloudinaryBundle = heroLcpPreloadBundle(imageUrl);
  if (cloudinaryBundle) {
    return (
      <link
        rel="preload"
        as="image"
        href={cloudinaryBundle.href}
        imageSrcSet={cloudinaryBundle.srcSet}
        imageSizes={sizes}
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
