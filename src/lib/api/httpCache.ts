/** Response headers for anonymous catalog JSON (shop listing API). */
export function publicCatalogCacheHeaders(maxAgeSeconds: number): HeadersInit {
  const swr = maxAgeSeconds * 2;
  return {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swr}`,
    Vary: "Accept-Encoding",
  };
}

/** Search results change more often — shorter shared cache. */
export function publicSearchCatalogCacheHeaders(maxAgeSeconds = 10): HeadersInit {
  const swr = maxAgeSeconds * 2;
  return {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swr}`,
    Vary: "Accept-Encoding",
  };
}

export function shopListingResponseHeaders(
  searchParams: URLSearchParams,
  options?: { listingCache?: "edge" | "live" }
): HeadersInit {
  const hasSearch = Boolean(searchParams.get("q")?.trim() || searchParams.get("ids")?.trim());
  const base = hasSearch
    ? publicSearchCatalogCacheHeaders(10)
    : publicCatalogCacheHeaders(300);
  return {
    ...base,
    ...(options?.listingCache ? { "X-Listing-Cache": options.listingCache } : {}),
  };
}

/** Session- or cookie-sensitive JSON — browser private cache only. */
export function privateResponseCacheHeaders(maxAgeSeconds: number): HeadersInit {
  const swr = maxAgeSeconds * 2;
  return {
    "Cache-Control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${swr}`,
  };
}

/** Mutations and auth — never cache. */
export function noStoreCacheHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}
