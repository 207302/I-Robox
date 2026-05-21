import { shopLcpPreloadHref } from "@/lib/shop/lcpImagePreload";

type Props = {
  src?: string | null;
};

/** Server-only: preload first product image for shop LCP. */
export default function ShopLcpPreload({ src }: Props) {
  const href = shopLcpPreloadHref(src);
  if (!href) return null;

  return <link rel="preload" as="image" href={href} fetchPriority="high" />;
}
