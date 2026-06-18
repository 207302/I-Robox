import { cloudinaryHeroMobileUrl, isCloudinaryDeliveryUrl } from "@/lib/images/cloudinaryDeliver";

type Props = {
  imageUrl?: string | null;
};

/** Server-only: preload mobile hero LCP (first slide). */
export default function HomeHeroLcpPreload({ imageUrl }: Props) {
  const raw = imageUrl?.trim();
  if (!raw) return null;

  const href = isCloudinaryDeliveryUrl(raw)
    ? cloudinaryHeroMobileUrl(raw, true)
    : raw.startsWith("http")
      ? raw
      : null;

  if (!href) return null;

  return <link rel="preload" as="image" href={href} fetchPriority="high" />;
}
