/** Canonical public site origin (no trailing slash). */
export function getSiteBaseUrl(): string {
  const trimmed =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return trimmed || "http://localhost:3000";
}

/** Absolute URL for email `<img src>` (remote CDN or site-relative paths). */
export function resolveAbsoluteUrl(pathOrUrl: string, baseUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  const base = baseUrl.replace(/\/$/, "");
  return t.startsWith("/") ? `${base}${t}` : `${base}/${t}`;
}
