import type { ShopQueryState } from "@/lib/shop/shopQuery";
import { parseShopQueryString } from "@/lib/shop/shopQuery";

/** Control param — not part of catalog filter semantics. */
export const SHOP_LISTING_FACETS_PARAM = "facets";

export type ShopListingRequestOptions = {
  /** When false, skip facet aggregation (pagination-only API calls). Default true. */
  includeFacets: boolean;
};

/** Stable key for `unstable_cache` (sorted multi-values). Returns null when search `q` is set. */
export function buildListingCacheKey(usp: URLSearchParams, includeFacets: boolean): string | null {
  if (usp.get("q")?.trim()) return null;
  const normalized = normalizeListingSearchParams(usp);
  normalized.delete(SHOP_LISTING_FACETS_PARAM);
  const qs = normalized.toString();
  if (!qs && includeFacets) return "default";
  return JSON.stringify({ qs, facets: includeFacets ? 1 : 0 });
}

/** Canonical query string for DB (sorted keys/values, strips `facets`). */
export function normalizeListingSearchParams(usp: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  const keys = [...new Set([...usp.keys()])].sort();
  for (const key of keys) {
    if (key === SHOP_LISTING_FACETS_PARAM) continue;
    const values = [...usp.getAll(key)].sort();
    for (const v of values) out.append(key, v);
  }
  return out;
}

export function parseListingRequestOptions(usp: URLSearchParams): ShopListingRequestOptions {
  const raw = usp.get(SHOP_LISTING_FACETS_PARAM);
  if (raw === "0" || raw === "false") return { includeFacets: false };
  return { includeFacets: true };
}

/** Fingerprint of all filters except page (for client pagination-only detection). */
export function listingFilterFingerprint(queryString: string): string {
  const state = parseShopQueryString(queryString);
  return listingFilterFingerprintFromState(state);
}

export function listingFilterFingerprintFromState(state: ShopQueryState): string {
  const usp = new URLSearchParams();
  if (state.q) usp.set("q", state.q);
  for (const c of [...state.categorySlugs].sort()) usp.append("category", c);
  for (const b of [...state.brands].sort()) usp.append("brand", b);
  for (const a of [...state.ageGroups].sort()) usp.append("ageGroup", a);
  for (const d of [...state.diecastScales].sort()) usp.append("diecastScale", d);
  for (const s of [...state.subtypes].sort()) usp.append("subtype", s);
  for (const c of [...state.collections].sort()) usp.append("collection", c);
  for (const d of [...state.discounts].sort()) usp.append("discount", d);
  if (state.minPrice) usp.set("minPrice", state.minPrice);
  if (state.maxPrice) usp.set("maxPrice", state.maxPrice);
  if (state.available) usp.set("available", state.available);
  if (state.sort) usp.set("sort", state.sort);
  return usp.toString();
}
