/** Canonical homepage hero banner dimensions (1440 × 580 assets). */
export const HERO_BANNER_WIDTH = 1440;
export const HERO_BANNER_HEIGHT = 580;

/** Tailwind aspect ratio class — keep in sync with HERO_BANNER_WIDTH / HEIGHT. */
export const HERO_BANNER_ASPECT_CLASS = "aspect-[1440/580]";

/** Cloudinary delivery width for mobile hero src. */
export const HERO_MOBILE_DELIVERY_WIDTH = 828;

export function heroBannerHeightForWidth(width: number): number {
  return Math.round((width * HERO_BANNER_HEIGHT) / HERO_BANNER_WIDTH);
}
