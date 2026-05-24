import type { ShopQueryState } from "@/lib/shop/shopQuery";
import { parseShopQueryString } from "@/lib/shop/shopQuery";

/** Map Next.js `searchParams` to listing API params (server shop page). */
export function listingSearchParamsFromRecord(
  sp: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v) params.append(key, v);
      }
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

/** Control param — not part of catalog filter semantics. */
export const SHOP_LISTING_FACETS_PARAM = "facets";
/** Client hint on pagination-only fetches — skip redundant COUNT (same filters, total unchanged). */
export const SHOP_LISTING_KNOWN_TOTAL_PARAM = "knownTotal";

const SHOP_LISTING_CONTROL_PARAMS = new Set([
  SHOP_LISTING_FACETS_PARAM,
  SHOP_LISTING_KNOWN_TOTAL_PARAM,
]);

export type ShopListingRequestOptions = {
  /** When false, skip facet aggregation (pagination-only API calls). Default true. */
  includeFacets: boolean;
  /** When set with page > 1, skip COUNT on default listing path (client already has total). */
  knownTotal?: number | null;
};

/** Stable key for listing-only `unstable_cache` (sorted multi-values). Returns null when search `q` is set. */
export function buildListingCacheKey(usp: URLSearchParams): string | null {
  if (usp.get("q")?.trim() || usp.get("ids")?.trim()) return null;
  const normalized = normalizeListingSearchParams(usp);
  normalized.delete(SHOP_LISTING_FACETS_PARAM);
  normalized.delete(SHOP_LISTING_KNOWN_TOTAL_PARAM);
  const qs = normalized.toString();
  if (!qs) return "default";
  return qs;
}

/** Canonical query string for DB (sorted keys/values, strips `facets`). */
export function normalizeListingSearchParams(usp: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  const keys = [...new Set([...usp.keys()])].sort();
  for (const key of keys) {
    if (SHOP_LISTING_CONTROL_PARAMS.has(key)) continue;
    const values = [...usp.getAll(key)].sort();
    for (const v of values) out.append(key, v);
  }
  return out;
}

export function parseListingRequestOptions(usp: URLSearchParams): ShopListingRequestOptions {
  const raw = usp.get(SHOP_LISTING_FACETS_PARAM);
  const includeFacets = raw !== "0" && raw !== "false";
  const knownRaw = usp.get(SHOP_LISTING_KNOWN_TOTAL_PARAM);
  const knownN = knownRaw != null && knownRaw !== "" ? Number(knownRaw) : NaN;
  const knownTotal =
    Number.isFinite(knownN) && knownN >= 0 ? Math.trunc(knownN) : null;
  return { includeFacets, knownTotal };
}

/** Fingerprint of all filters except page (for client pagination-only detection). */
export function listingFilterFingerprint(queryString: string): string {
  const state = parseShopQueryString(queryString);
  const usp = new URLSearchParams(listingFilterFingerprintFromState(state));
  const ids = new URLSearchParams(queryString).get("ids")?.trim();
  if (ids) usp.set("ids", ids);
  return usp.toString();
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
