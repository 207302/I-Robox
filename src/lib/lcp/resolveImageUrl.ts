import { getSiteBaseUrl } from "@/lib/siteUrl";

/** Absolute URL for preload / optimizer (supports `/public` paths and remote URLs). */
export function resolvePublicImageUrl(src: string): string | null {
  const t = src?.trim();
  if (!t || t === "/images/404.svg") return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  const base = getSiteBaseUrl().replace(/\/$/, "");
  return t.startsWith("/") ? `${base}${t}` : `${base}/${t}`;
}
