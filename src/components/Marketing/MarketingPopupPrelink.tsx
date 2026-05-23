import {
  cloudinaryDeliverUrl,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";

type Props = {
  imageUrl: string | null;
};

/** Preload marketing popup image from HTML when URL is known at layout render (shop LCP). */
export default function MarketingPopupPrelink({ imageUrl }: Props) {
  const raw = imageUrl?.trim();
  if (!raw) return null;

  const href = isCloudinaryDeliveryUrl(raw)
    ? cloudinaryDeliverUrl(raw, { width: 512, quality: "auto:best", crop: "limit" })
    : raw;

  return (
    <link
      rel="preload"
      as="image"
      href={href}
      fetchPriority="high"
    />
  );
}
