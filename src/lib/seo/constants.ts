/** Canonical public origin for SEO (sitemap, schema, Open Graph). */
export const SEO_SITE_URL = "https://i-robox.com";

export const SEO_SITE_NAME = "i-robox";

/** Visible homepage H1 when Admin → Marketing hero overlay heading is empty. */
export const HOME_HERO_H1_FALLBACK = "Premium RC Toys & Diecast Collectibles in India";

export function resolveHomeHeroHeading(heading?: string | null): string {
  const trimmed = heading?.trim();
  return trimmed || HOME_HERO_H1_FALLBACK;
}

export const DEFAULT_OG_IMAGE = `${SEO_SITE_URL}/images/favicon.png`;
