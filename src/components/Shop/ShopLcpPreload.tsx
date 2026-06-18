import { shopLcpPreloadHref } from "@/lib/shop/lcpImagePreload";
import {
  cloudinaryProductCardSrcSet,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";

type Props = {
  src?: string | null;
};

/** Server-only: preload first product image for shop LCP. */
export default function ShopLcpPreload({ src }: Props) {
  const href = shopLcpPreloadHref(src);
  if (!href) return null;

  const resolved = resolveProductImageSrc(src);
  if (resolved && isCloudinaryDeliveryUrl(resolved)) {
    const { srcSet } = cloudinaryProductCardSrcSet(resolved);
    return (
      <link
        rel="preload"
        as="image"
        href={href}
        imageSrcSet={srcSet}
        imageSizes="(max-width: 639px) min(calc(100vw - 2rem), 380px), 280px"
        fetchPriority="high"
      />
    );
  }

  return <link rel="preload" as="image" href={href} fetchPriority="high" />;
}
