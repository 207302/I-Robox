import Image from "next/image";
import { cloudinaryCardUrl } from "@/lib/images/cloudinaryDeliver";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";

type AdminProductThumbnailProps = {
  url?: string | null;
  alt: string;
  size?: number;
};

export function adminProductThumbnailSrc(url: string | null | undefined, size = 96): string {
  const trimmed = url?.trim();
  if (!trimmed) return PRODUCT_IMAGE_PLACEHOLDER;
  if (trimmed.startsWith("http")) return cloudinaryCardUrl(trimmed, size);
  return trimmed;
}

export function AdminProductThumbnail({ url, alt, size = 48 }: AdminProductThumbnailProps) {
  const src = adminProductThumbnailSrc(url, size * 2);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded border border-gray-3 bg-gray-2"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill className="object-cover" sizes={`${size}px`} />
    </div>
  );
}
