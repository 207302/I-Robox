/**
 * Next.js `<Link>` prefetches RSC payloads when links enter the viewport.
 * Default false for body/footer/CTA links — only the DesktopMenu top-level Shop link omits this.
 */
export function shouldPrefetchHref(_href: string): boolean {
  return false;
}

/** Exact `/shop` (no query/hash) — sole nav link that keeps Link prefetch default. */
export function isMainNavShopHref(href: string): boolean {
  const raw = (href || "#").trim();
  if (!raw || raw === "#") return false;
  const [path] = (raw.split("#")[0] ?? "").split("?");
  return path === "/shop";
}
