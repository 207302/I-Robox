import type { ShopListingData } from "@/lib/shop/shopListing";

type Entry = {
  listing: ShopListingData;
  savedAt: number;
};

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, Entry>();

/** Keep infinite-scroll results so browser-back can restore scroll position. */
export function getCachedShopListing(key: string): ShopListingData | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.listing;
}

export function setCachedShopListing(key: string, listing: ShopListingData) {
  if (!key) return;
  cache.set(key, { listing, savedAt: Date.now() });
}

export function clearCachedShopListing(key: string) {
  cache.delete(key);
}
