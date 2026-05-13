import { getImageProps } from "next/image";

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
 * so the browser requests the LCP candidate early.
 */
export default function LcpImagePrelink({
  imageUrl,
  sizes,
  width = 640,
  height = 640,
  quality = 75,
}: Props) {
  if (!imageUrl || imageUrl === "/images/404.svg" || !imageUrl.startsWith("http")) {
    return null;
  }

  try {
    const { props } = getImageProps({
      src: imageUrl,
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
