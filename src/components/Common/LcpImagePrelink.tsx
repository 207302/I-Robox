import { getImageProps } from "next/image";
import { resolvePublicImageUrl } from "@/lib/lcp/resolveImageUrl";

type Props = {
  imageUrl: string;
  /** Must match the corresponding `next/image` `sizes` for the same URL. */
  sizes: string;
  width?: number;
  height?: number;
  quality?: number;
};

/**
 * Renders `<link rel="preload" as="image">` using the same optimizer output as `next/image`
 * so the browser requests the LCP candidate early (hoisted to document head).
 */
export default function LcpImagePrelink({
  imageUrl,
  sizes,
  width = 640,
  height = 640,
  quality = 75,
}: Props) {
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
        imageSizes={props.sizes || undefined}
        fetchPriority="high"
      />
    );
  } catch {
    return null;
  }
}
