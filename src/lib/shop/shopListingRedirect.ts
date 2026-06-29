import type { ShopQueryState } from "@/lib/shop/shopQuery";

/** When shop has only a single brand or category filter, redirect to the dedicated landing page. */
export function shopListingRedirectTarget(state: ShopQueryState): string | null {
  const hasOtherFilters = Boolean(
    state.q.trim() ||
      state.minPrice.trim() ||
      state.maxPrice.trim() ||
      state.ageGroups.length ||
      state.diecastScales.length ||
      state.subtypes.length ||
      state.collections.length ||
      state.discounts.length ||
      state.available ||
      state.sort ||
      state.page > 1
  );
  if (hasOtherFilters) return null;

  if (state.brands.length === 1 && state.categorySlugs.length === 0) {
    return `/brand/${encodeURIComponent(state.brands[0]!)}`;
  }
  if (state.categorySlugs.length === 1 && state.brands.length === 0) {
    return `/category/${encodeURIComponent(state.categorySlugs[0]!)}`;
  }
  return null;
}
