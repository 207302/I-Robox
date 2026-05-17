import type { CSSProperties } from "react";

export type SiteChromeColors = {
  utilityBarBg: string | null;
  marqueeBarBg: string | null;
  footerBg: string | null;
  footerText: string | null;
  footerLink: string | null;
};

export const EMPTY_CHROME_COLORS: SiteChromeColors = {
  utilityBarBg: null,
  marqueeBarBg: null,
  footerBg: null,
  footerText: null,
  footerLink: null,
};

export function chromeBgStyle(color?: string | null): CSSProperties | undefined {
  const t = color?.trim();
  if (!t) return undefined;
  return { backgroundColor: t };
}

export function chromeTextStyle(color?: string | null): CSSProperties | undefined {
  const t = color?.trim();
  if (!t) return undefined;
  return { color: t };
}

export type FooterColorStyles = {
  textStyle?: CSSProperties;
  linkStyle?: CSSProperties;
  iconFill?: string;
};

export function footerColorStyles(colors?: SiteChromeColors): FooterColorStyles {
  const link = colors?.footerLink?.trim();
  const text = colors?.footerText?.trim();
  return {
    textStyle: chromeTextStyle(colors?.footerText),
    linkStyle: chromeTextStyle(colors?.footerLink),
    iconFill: link || text || undefined,
  };
}
