import {
  buildListingQueryString,
  type ShopQueryState,
} from "@/lib/shop/shopQuery";

/** Filter fields edited in the shop sidebar before Apply. */
export type ShopFilterDraft = Omit<ShopQueryState, "q" | "page">;

export function shopQueryToFilterDraft(state: ShopQueryState): ShopFilterDraft {
  const { q: _q, page: _page, ...draft } = state;
  return draft;
}

/** True when any filter beyond a lone brand or lone category is set. */
export function hasExtraShopFilters(draft: ShopFilterDraft): boolean {
  return (
    draft.ageGroups.length > 0 ||
    draft.diecastScales.length > 0 ||
    draft.subtypes.length > 0 ||
    draft.collections.length > 0 ||
    draft.discounts.length > 0 ||
    Boolean(draft.minPrice.trim()) ||
    Boolean(draft.maxPrice.trim()) ||
    draft.available === "true" ||
    Boolean(draft.sort) ||
    draft.brands.length > 1 ||
    draft.categorySlugs.length > 1 ||
    (draft.brands.length === 1 && draft.categorySlugs.length === 1)
  );
}

export type ShopFilterApplyDestination =
  | { type: "brand"; slug: string }
  | { type: "category"; slug: string }
  | { type: "shop"; state: ShopQueryState };

/**
 * Single brand only → brand page. Single category only → category page.
 * Multiple or mixed filters (or active search) → stay on shop with query applied.
 */
export function resolveShopFilterApplyDestination(
  draft: ShopFilterDraft,
  searchQ: string
): ShopFilterApplyDestination {
  const trimmedSearch = searchQ.trim();
  const shopState: ShopQueryState = { ...draft, q: trimmedSearch, page: 1 };

  if (!trimmedSearch && !hasExtraShopFilters(draft)) {
    if (draft.brands.length === 1 && draft.categorySlugs.length === 0) {
      return { type: "brand", slug: draft.brands[0]! };
    }
    if (draft.categorySlugs.length === 1 && draft.brands.length === 0) {
      return { type: "category", slug: draft.categorySlugs[0]! };
    }
  }

  return { type: "shop", state: shopState };
}

export function buildShopApplyQueryString(
  draft: ShopFilterDraft,
  searchQ: string
): string {
  const dest = resolveShopFilterApplyDestination(draft, searchQ);
  if (dest.type === "shop") {
    return buildListingQueryString(dest.state);
  }
  return "";
}
