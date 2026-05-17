import type { CSSProperties } from "react";

export type SiteChromeColors = {
  utilityBarBg: string | null;
  marqueeBarBg: string | null;
  footerBg: string | null;
};

export const EMPTY_CHROME_COLORS: SiteChromeColors = {
  utilityBarBg: null,
  marqueeBarBg: null,
  footerBg: null,
};

export function chromeBgStyle(color?: string | null): CSSProperties | undefined {
  const t = color?.trim();
  if (!t) return undefined;
  return { backgroundColor: t };
}
