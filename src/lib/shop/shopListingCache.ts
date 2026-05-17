import { unstable_cache } from "next/cache";
import { PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG } from "@/lib/cache/tags";
import { onCacheMiss } from "@/lib/observability/cache";
import {
  buildListingCacheKey,
  normalizeListingSearchParams,
  parseListingRequestOptions,
  type ShopListingRequestOptions,
} from "@/lib/shop/shopListingParams";
import { getShopListing, type ShopListingData, type ShopListingResult } from "@/lib/shop/shopListing";

/** Align with `GET /api/products` and shop ISR. */
export const SHOP_LISTING_API_REVALIDATE_SECONDS = 30;

export type ShopListingCacheSource = "edge" | "live";

export type ShopListingApiEnvelope =
  | { ok: true; data: ShopListingData; listingCache: ShopListingCacheSource }
  | { ok: false; error: string; status: number };

async function loadShopListing(
  normalized: URLSearchParams,
  options: ShopListingRequestOptions
): Promise<ShopListingResult> {
  return getShopListing(normalized, options);
}

/**
 * Cached shop listing for GET /api/products.
 * - Normalizes query params for stable cache keys.
 * - Skips `unstable_cache` when `q` is present (search freshness).
 */
export async function getShopListingForApi(
  rawParams: URLSearchParams
): Promise<ShopListingApiEnvelope> {
  const options = parseListingRequestOptions(rawParams);
  const normalized = normalizeListingSearchParams(rawParams);
  const cacheKey = buildListingCacheKey(normalized, options.includeFacets);

  if (!cacheKey) {
    const result = await loadShopListing(normalized, options);
    if (!result.ok) return result;
    return { ...result, listingCache: "live" };
  }

  const cached = unstable_cache(
    onCacheMiss(`shop-listing:${cacheKey}`, () => loadShopListing(normalized, options)),
    ["shop-listing-api", cacheKey],
    {
      revalidate: SHOP_LISTING_API_REVALIDATE_SECONDS,
      tags: [SHOP_LISTING_TAG, PRODUCT_CATALOG_TAG],
    }
  );

  const result = await cached();
  if (!result.ok) return result;
  return { ...result, listingCache: "edge" };
}
