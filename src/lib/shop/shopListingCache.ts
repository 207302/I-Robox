import { unstable_cache } from "next/cache";
import { PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG } from "@/lib/cache/tags";
import { onCacheMiss } from "@/lib/observability/cache";
import {
  buildListingCacheKey,
  normalizeListingSearchParams,
  parseListingRequestOptions,
} from "@/lib/shop/shopListingParams";
import {
  getShopListing,
  mergeShopListingData,
  type ShopListingData,
  type ShopListingResult,
} from "@/lib/shop/shopListing";
import { getShopListingFacetsOnly } from "@/lib/shop/shopListingPrepare";

/** Align with `GET /api/products` and shop ISR. */
export const SHOP_LISTING_API_REVALIDATE_SECONDS = 60;

export type ShopListingCacheSource = "edge" | "live";

export type ShopListingApiEnvelope =
  | { ok: true; data: ShopListingData; listingCache: ShopListingCacheSource }
  | { ok: false; error: string; status: number };

function envelope(
  result: ShopListingResult,
  listingCache: ShopListingCacheSource
): ShopListingApiEnvelope {
  if (!result.ok) return result;
  return { ...result, listingCache };
}

async function loadCachedListingOnly(normalized: URLSearchParams): Promise<ShopListingResult> {
  return getShopListing(normalized, { includeFacets: false });
}

/**
 * Cached shop listing for GET /api/products.
 * - Facets and product rows use separate cache layers (merge before respond).
 * - Skips `unstable_cache` when `q` is present (search freshness).
 */
export async function getShopListingForApi(
  rawParams: URLSearchParams
): Promise<ShopListingApiEnvelope> {
  const options = parseListingRequestOptions(rawParams);
  const normalized = normalizeListingSearchParams(rawParams);
  const listingKey = buildListingCacheKey(normalized);

  if (!listingKey) {
    const result = await getShopListing(normalized, options);
    return envelope(result, "live");
  }

  const cachedListing = unstable_cache(
    onCacheMiss(`shop-listing:${listingKey}`, () => loadCachedListingOnly(normalized)),
    ["shop-listing-api", listingKey],
    {
      revalidate: SHOP_LISTING_API_REVALIDATE_SECONDS,
      tags: [SHOP_LISTING_TAG, PRODUCT_CATALOG_TAG],
    }
  );

  if (!options.includeFacets) {
    const result = await cachedListing();
    return envelope(result, "edge");
  }

  const [listingResult, facetsResult] = await Promise.all([
    cachedListing(),
    getShopListingFacetsOnly(normalized),
  ]);

  if (!listingResult.ok) return listingResult;
  if (!facetsResult.ok) return facetsResult;

  return envelope(
    {
      ok: true,
      data: mergeShopListingData(listingResult.data, facetsResult.facets),
    },
    "edge"
  );
}
