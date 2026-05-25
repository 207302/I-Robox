import { getShopListingForApi } from "./shopListingCache";

/**
 * Pre-fetch the default (no-filter) shop listing for pages 1-3.
 * Populates `unstable_cache` entries so the first real visitor after a cold
 * start does not pay the full Neon cold-miss latency on the catalog query.
 *
 * Best-effort: all errors are swallowed; this is called once at instrumentation
 * boot, never in a request path.
 */
export async function warmShopListingCache(): Promise<void> {
  const pages = ["", "page=2", "page=3"];
  await Promise.allSettled(
    pages.map((qs) =>
      getShopListingForApi(new URLSearchParams(qs)).catch(() => undefined)
    )
  );
}
