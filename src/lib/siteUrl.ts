/** Canonical public site origin (no trailing slash). */
export function getSiteBaseUrl(): string {
  const trimmed =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return trimmed || "http://localhost:3000";
}

const INVALID_REDIRECT_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

/** Browser-safe origin for redirects (avoids 0.0.0.0 bind address in dev). */
export function getRequestOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
    return `${proto}://${forwardedHost}`;
  }

  const host = req.headers.get("host")?.trim();
  const hostName = host?.split(":")[0] ?? "";
  if (host && hostName && !INVALID_REDIRECT_HOSTS.has(hostName)) {
    try {
      const proto = new URL(req.url).protocol === "https:" ? "https" : "http";
      return `${proto}://${host}`;
    } catch {
      return `http://${host}`;
    }
  }

  try {
    const parsed = new URL(req.url);
    if (!INVALID_REDIRECT_HOSTS.has(parsed.hostname)) return parsed.origin;
  } catch {
    /* use env fallback */
  }

  return getSiteBaseUrl();
}

export function redirectUrl(req: Request, pathname: string): URL {
  return new URL(pathname, `${getRequestOrigin(req)}/`);
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
