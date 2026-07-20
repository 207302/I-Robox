/** Shared hero dimensions — aspect-ratio matched to Cloudinary delivery crops.
 *  Mobile stays close to authored 1370×1148, nudged slightly taller. */
export const HERO_ASPECT_CLASS = "aspect-[1370/1180] md:aspect-[1440/520]";

/** Outer hero image box — aspect + min/max guards (no fixed h-[] that fights aspect). */
export const HERO_HEIGHT_CLASS =
  "aspect-[1370/1180] min-h-[280px] max-h-[460px] md:aspect-[1440/520] md:min-h-[440px] md:max-h-[640px]";

/** @deprecated Prefer HERO_HEIGHT_CLASS — kept for any stray imports during transition. */
export const HERO_MIN_HEIGHT_CLASS = HERO_HEIGHT_CLASS;

export const HERO_OVERLAY_TRUST_BADGES = [
  { label: "100% Genuine Products" },
  { label: "Fast Pan-India Shipping" },
  { label: "Easy Returns" },
] as const;
