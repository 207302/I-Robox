import type { CSSProperties } from "react";

export type HeroOverlayColors = {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  ctaLabel?: string;
};

export function heroOverlayTextStyle(color?: string | null): CSSProperties | undefined {
  const t = color?.trim();
  if (!t) return undefined;
  return { color: t };
}
