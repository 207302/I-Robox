import { unstable_cache } from "next/cache";
import { PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG } from "@/lib/cache/tags";
import { onCacheMiss } from "@/lib/observability/cache";
import {
  buildListingCacheKey,
  normalizeListingSearchParams,
  parseListingRequestOptions,
  type ShopListingRequestOptions,
} from "@/lib/shop/shopListingParams";
import {
  getShopListing,
  mergeShopListingData,
  type ShopListingData,
  type ShopListingResult,
} from "@/lib/shop/shopListing";
import { getShopListingFacetsOnly } from "@/lib/shop/shopListingPrepare";
import { listingMemory } from "@/lib/shop/shopListingMemory";

/** Align with `GET /api/products` and shop ISR. */
export const SHOP_LISTING_API_REVALIDATE_SECONDS = 300;
/** Search (`q` / `ids`) changes more often than filtered catalog pages. */
const SHOP_LISTING_SEARCH_REVALIDATE_SECONDS = 20;
const LISTING_MEMORY_TTL_MS = 30_000;

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

type ListingCachePlan = {
  key: string;
  revalidate: number;
  /** Filter pages keep rows and facets in separate layers. Search is one short-lived entry. */
  splitFacets: boolean;
  skipFlashSales: boolean;
};

function listingCachePlan(
  normalized: URLSearchParams,
  options: ShopListingRequestOptions
): ListingCachePlan {
  const listingKey = buildListingCacheKey(normalized);
  if (listingKey) {
    return {
      key: options.skipFlashSales ? `noflash:${listingKey}` : listingKey,
      revalidate: SHOP_LISTING_API_REVALIDATE_SECONDS,
      splitFacets: true,
      skipFlashSales: Boolean(options.skipFlashSales),
    };
  }
  const qs = normalized.toString() || "default";
  return {
    key: `search:${qs}${options.skipFlashSales ? ":noflash" : ""}`,
    revalidate: SHOP_LISTING_SEARCH_REVALIDATE_SECONDS,
    splitFacets: false,
    skipFlashSales: Boolean(options.skipFlashSales),
  };
}

async function loadCachedListingOnly(
  normalized: URLSearchParams,
  skipFlashSales: boolean
): Promise<ShopListingResult> {
  return getShopListing(normalized, { includeFacets: false, skipFlashSales });
}

async function loadListingEnvelope(
  normalized: URLSearchParams,
  options: ShopListingRequestOptions,
  plan: ListingCachePlan
): Promise<ShopListingApiEnvelope> {
  if (!plan.splitFacets) {
    const result = await unstable_cache(
      onCacheMiss(`shop-listing:${plan.key}`, () => getShopListing(normalized, options)),
      ["shop-listing-api", plan.key, options.includeFacets ? "facets" : "rows"],
      {
        revalidate: plan.revalidate,
        tags: [SHOP_LISTING_TAG, PRODUCT_CATALOG_TAG],
      }
    )();
    return envelope(result, "edge");
  }

  const cachedListing = unstable_cache(
    onCacheMiss(`shop-listing:${plan.key}`, () =>
      loadCachedListingOnly(normalized, plan.skipFlashSales)
    ),
    ["shop-listing-api", plan.key],
    {
      revalidate: plan.revalidate,
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

/**
 * Cached shop listing for GET /api/products.
 * Filter pages keep rows and facets in separate layers. Search and `noFlash`
 * use their own keys so they cannot poison the full listing entry. Concurrent
 * misses for the same key share one database load.
 */
export async function getShopListingForApi(
  rawParams: URLSearchParams
): Promise<ShopListingApiEnvelope> {
  const options = parseListingRequestOptions(rawParams);
  const normalized = normalizeListingSearchParams(rawParams);
  const plan = listingCachePlan(normalized, options);
  const memoryKey = `${plan.key}|facets:${options.includeFacets ? "1" : "0"}`;
  const memoryTtlMs = Math.min(plan.revalidate * 1000, LISTING_MEMORY_TTL_MS);

  return listingMemory.load(
    memoryKey,
    memoryTtlMs,
    () => loadListingEnvelope(normalized, options, plan),
    (value) => value.ok
  );
}
