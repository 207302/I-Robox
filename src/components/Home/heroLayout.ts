import { HERO_BANNER_ASPECT_CLASS } from "@/lib/images/heroDimensions";

/** Full-bleed hero frame — matches 1440×580 banner assets. */
export const HERO_FRAME_CLASS = `relative w-full touch-pan-y overflow-hidden ${HERO_BANNER_ASPECT_CLASS}`;

export const HERO_OVERLAY_TRUST_BADGES = [
  { label: "100% Genuine Products" },
  { label: "Fast Pan-India Shipping" },
  { label: "Easy Returns" },
] as const;
