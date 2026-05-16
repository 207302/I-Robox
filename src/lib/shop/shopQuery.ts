export const SHOP_QUERY_EVENT = "irobox-shop-query";

export type ShopQueryState = {
  q: string;
  categorySlugs: string[];
  brands: string[];
  ageGroups: string[];
  diecastScales: string[];
  types: string[];
  subtypes: string[];
  collections: string[];
  discounts: string[];
  minPrice: string;
  maxPrice: string;
  available: string;
  sort: string;
  page: number;
};

export function parseShopQueryString(queryString: string): ShopQueryState {
  const usp = new URLSearchParams(queryString);
  const pickMulti = (key: string) => [...new Set(usp.getAll(key).map((v) => v.trim()).filter(Boolean))];
  const sortRaw = usp.get("sort")?.trim() ?? "";
  const page = Number(usp.get("page") || "1");
  return {
    q: usp.get("q")?.trim() ?? "",
    categorySlugs: pickMulti("category"),
    brands: pickMulti("brand"),
    ageGroups: pickMulti("ageGroup"),
    diecastScales: pickMulti("diecastScale"),
    types: pickMulti("type"),
    subtypes: pickMulti("subtype"),
    collections: pickMulti("collection"),
    discounts: pickMulti("discount"),
    minPrice: usp.get("minPrice")?.trim() ?? "",
    maxPrice: usp.get("maxPrice")?.trim() ?? "",
    available: usp.get("available")?.trim() ?? "",
    sort: sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function buildListingQueryString(state: ShopQueryState): string {
  const usp = new URLSearchParams();
  if (state.q) usp.set("q", state.q);
  for (const c of state.categorySlugs) usp.append("category", c);
  for (const b of state.brands) usp.append("brand", b);
  for (const a of state.ageGroups) usp.append("ageGroup", a);
  for (const d of state.diecastScales) usp.append("diecastScale", d);
  for (const t of state.types) usp.append("type", t);
  for (const s of state.subtypes) usp.append("subtype", s);
  for (const c of state.collections) usp.append("collection", c);
  for (const d of state.discounts) usp.append("discount", d);
  if (state.minPrice) usp.set("minPrice", state.minPrice);
  if (state.maxPrice) usp.set("maxPrice", state.maxPrice);
  if (state.available) usp.set("available", state.available);
  if (state.sort === "price_asc" || state.sort === "price_desc") usp.set("sort", state.sort);
  if (state.page > 1) usp.set("page", String(state.page));
  return usp.toString();
}

/** Updates the URL without a Next.js RSC navigation; triggers client shop fetch listeners. */
export function applyShopQuery(pathname: string, queryString: string) {
  const url = queryString ? `${pathname}?${queryString}` : pathname;
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(
    new CustomEvent(SHOP_QUERY_EVENT, { detail: { queryString } })
  );
}

export function paginationItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return [];
  const clamped = Math.max(1, Math.min(total, current));

  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const add = (set: Set<number>, p: number) => {
    if (p >= 1 && p <= total) set.add(p);
  };
  const set = new Set<number>();
  add(set, 1);
  add(set, 2);
  add(set, 3);
  add(set, 4);
  add(set, total - 2);
  add(set, total - 1);
  add(set, total);
  add(set, clamped - 1);
  add(set, clamped);
  add(set, clamped + 1);

  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}
