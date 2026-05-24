/**
 * Next.js `<Link>` prefetches RSC payloads when links enter the viewport.
 * Only bare `/` and `/shop` (no query) are worth prefetching on the storefront.
 */
export function shouldPrefetchHref(href: string): boolean {
  const raw = (href || "#").trim();
  if (!raw || raw === "#") return false;

  const pathPart = raw.split("#")[0] ?? "";
  const [path, query] = pathPart.split("?");
  if (query) return false;

  return path === "/" || path === "/shop";
}
