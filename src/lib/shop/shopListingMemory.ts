import { createSingleflightCache } from "@/lib/cache/singleflight";
import type { ShopListingApiEnvelope } from "@/lib/shop/shopListingCache";

/** In-process listing copy. Kept separate so cache invalidation does not import the listing query graph. */
export const listingMemory = createSingleflightCache<ShopListingApiEnvelope>({ maxEntries: 200 });

export function clearShopListingMemoryCache(): void {
  listingMemory.clear();
}
