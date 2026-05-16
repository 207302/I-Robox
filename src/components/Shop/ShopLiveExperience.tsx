"use client";

import ProductItem from "@/components/Common/ProductItem";
import LiveShopFilters from "@/components/Shop/LiveShopFilters";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import type { ShopListingData } from "@/lib/shop/shopListing";
import {
  SHOP_QUERY_EVENT,
  applyShopQuery,
  buildListingQueryString,
  paginationItems,
  parseShopQueryString,
  type ShopQueryState,
} from "@/lib/shop/shopQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DIECAST_ONLY_CATEGORY = "toy cars, trains & vehicles";

type CategoryRow = {
  id: string;
  slug: string;
  name?: string;
  title?: string;
};

type Props = {
  initialListing: ShopListingData;
  initialQueryString: string;
  allCategories: CategoryRow[];
};

export default function ShopLiveExperience({
  initialListing,
  initialQueryString,
  allCategories,
}: Props) {
  const pathname = usePathname();
  const [listing, setListing] = useState(initialListing);
  const [queryString, setQueryString] = useState(initialQueryString);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipFetchRef = useRef(true);

  const query = parseShopQueryString(queryString);
  const debouncedQ = useDebounce(query.q, 350);
  const effectiveQueryString = useMemo(() => {
    const parsed = parseShopQueryString(queryString);
    return buildListingQueryString({ ...parsed, q: debouncedQ });
  }, [queryString, debouncedQ]);
  const searchPending = query.q !== debouncedQ;

  const fetchListing = useCallback(async (qs: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(qs ? `/api/products?${qs}` : "/api/products", {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = (await res.json()) as ShopListingData & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      if (!controller.signal.aborted) {
        setListing(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[shop] listing fetch failed", err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const onQuery = (event: Event) => {
      const detail = (event as CustomEvent<{ queryString: string }>).detail;
      const next = detail?.queryString ?? "";
      setQueryString(next);
    };
    window.addEventListener(SHOP_QUERY_EVENT, onQuery);
    return () => window.removeEventListener(SHOP_QUERY_EVENT, onQuery);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const qs = window.location.search.replace(/^\?/, "");
      setQueryString(qs);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      if (effectiveQueryString === initialQueryString) return;
    }
    void fetchListing(effectiveQueryString);
  }, [effectiveQueryString, fetchListing, initialQueryString]);

  const goToPage = (page: number) => {
    const nextState: ShopQueryState = { ...query, page };
    applyShopQuery(pathname, buildListingQueryString(nextState));
  };

  const clearFilters = () => {
    applyShopQuery(pathname, "");
  };

  const products = listing.items ?? [];
  const totalPages = Math.max(1, listing.totalPages ?? 1);
  const currentPage = listing.page ?? query.page;
  const ageGroups = listing.ageGroups ?? [];
  const diecastScales = listing.diecastScales ?? [];
  const shopBrands = listing.brands ?? [];
  const productTypes = listing.productTypes ?? [];
  const productSubtypes = listing.productSubtypes ?? [];
  const productCollections = listing.productCollections ?? [];
  const discountBuckets = listing.discountBuckets ?? [];
  const hasCategorySelection = query.categorySlugs.length > 0;
  const hasTypeSelection = query.types.length > 0;
  const selectedCategoryNames = new Set(
    allCategories
      .filter((cat) => query.categorySlugs.includes(cat.slug))
      .map((cat) => (cat.name ?? cat.title ?? "").trim().toLowerCase())
  );
  const showScales = selectedCategoryNames.has(DIECAST_ONLY_CATEGORY);

  const renderFilters = (formId: string) => (
    <div className="rounded-xl border border-gray-3 bg-white p-5">
      <form id={formId} className="mb-5 space-y-3" onSubmit={(e) => e.preventDefault()}>
        <LiveShopFilters formId={formId} queryString={queryString} />
        <input
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="Search products…"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="minPrice"
            defaultValue={query.minPrice}
            placeholder="Min ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <input
            name="maxPrice"
            defaultValue={query.maxPrice}
            placeholder="Max ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </div>
        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Age groups</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {ageGroups.map((group) => (
              <li key={group}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="ageGroup"
                    value={group}
                    defaultChecked={query.ageGroups.includes(group)}
                  />
                  {group}
                </label>
              </li>
            ))}
          </ul>
        </details>

        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Categories</summary>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
            {allCategories.length > 0 ? (
              allCategories.map((cat) => (
                <li key={cat.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-dark-4 hover:text-blue">
                    <input
                      type="checkbox"
                      name="category"
                      value={cat.slug}
                      defaultChecked={query.categorySlugs.includes(cat.slug)}
                      className="mt-0.5 rounded border-gray-3 text-blue focus:ring-blue"
                    />
                    <span className="leading-snug">{cat.name ?? cat.title ?? cat.slug}</span>
                  </label>
                </li>
              ))
            ) : (
              <li className="text-meta-4 text-sm">No categories yet.</li>
            )}
          </ul>
        </details>

        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Brands</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {shopBrands.map((b) => (
              <li key={b.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="brand"
                    value={b.slug}
                    defaultChecked={query.brands.includes(b.slug)}
                  />
                  {b.name} ({b.count})
                </label>
              </li>
            ))}
          </ul>
        </details>

        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Product types</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {productTypes.map((t) => (
              <li key={t.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="type"
                    value={t.slug}
                    defaultChecked={query.types.includes(t.slug)}
                  />
                  {t.name} ({t.count})
                </label>
              </li>
            ))}
            {!hasCategorySelection ? (
              <li className="text-xs text-meta-4">Select categories to narrow types.</li>
            ) : null}
          </ul>
        </details>

        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Subtypes</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {productSubtypes.map((s) => (
              <li key={s.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="subtype"
                    value={s.slug}
                    defaultChecked={query.subtypes.includes(s.slug)}
                  />
                  {s.name} ({s.count})
                </label>
              </li>
            ))}
            {!hasTypeSelection ? (
              <li className="text-xs text-meta-4">Select type(s) to narrow subtypes.</li>
            ) : null}
          </ul>
        </details>

        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Collections</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {productCollections.map((c) => (
              <li key={c.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="collection"
                    value={c.slug}
                    defaultChecked={query.collections.includes(c.slug)}
                  />
                  {c.name} ({c.count})
                </label>
              </li>
            ))}
            {!hasCategorySelection ? (
              <li className="text-xs text-meta-4">Select categories to narrow collections.</li>
            ) : null}
          </ul>
        </details>

        <details open className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Discount</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {discountBuckets.map((d) => (
              <li key={d.id}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="discount"
                    value={d.id}
                    defaultChecked={query.discounts.includes(d.id)}
                  />
                  {d.label} ({d.count})
                </label>
              </li>
            ))}
          </ul>
        </details>

        {showScales ? (
          <details open className="rounded-lg border border-gray-3 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-dark">Scales</summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {diecastScales.map((s) => (
                <li key={s}>
                  <label className="flex items-center gap-2 text-sm text-dark-4">
                    <input
                      type="checkbox"
                      name="diecastScale"
                      value={s}
                      defaultChecked={query.diecastScales.includes(s)}
                    />
                    {s}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-meta-3">
          <input
            type="checkbox"
            name="available"
            value="true"
            defaultChecked={query.available === "true"}
          />
          In stock only
        </label>

        <div>
          <label className="mb-1 block text-sm font-semibold text-dark">Sort by</label>
          <select
            name="sort"
            defaultValue={query.sort}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          >
            <option value="">Newest first</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="block w-full rounded-lg border border-gray-3 bg-white px-4 py-2 text-center text-sm font-medium text-meta-3 hover:bg-gray-1 hover:text-dark transition"
        >
          Clear filters
        </button>
      </form>
    </div>
  );

  return (
    <section className="overflow-hidden py-10 pb-20">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-64">
            <div className="lg:hidden">{renderFilters("shop-filters-form-mobile")}</div>
            <div className="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
              {renderFilters("shop-filters-form")}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-dark">Shop</h1>
              {searchPending || loading ? (
                <span className="text-xs font-medium text-meta-3 animate-pulse">Updating…</span>
              ) : null}
            </div>
            {searchPending || loading ? (
              <div
                className="mb-4 h-0.5 w-full overflow-hidden rounded-full bg-gray-2"
                role="status"
                aria-label="Loading products"
              >
                <div className="h-full w-1/3 animate-pulse rounded-full bg-blue" />
              </div>
            ) : null}
            <div
              className={
                searchPending || loading
                  ? "opacity-50 pointer-events-none transition-opacity"
                  : "transition-opacity"
              }
              aria-busy={searchPending || loading}
            >
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-7.5 gap-y-9">
                  {products.map((item, index) => (
                    <ProductItem
                      item={{
                        id: item.id,
                        title: item.title,
                        price: item.price,
                        discountedPrice: item.discountedPrice,
                        slug: item.slug,
                        quantity: item.quantity,
                        updatedAt: item.updatedAt,
                        reviews: item.reviews,
                        shortDescription: item.shortDescription,
                        ageGroup: item.ageGroup,
                        diecastScale: item.diecastScale,
                        shippingPerUnit: item.shippingPerUnit,
                        productVariants: item.productVariants,
                        product_images: item.product_images,
                        image: item.image,
                      }}
                      key={item.id}
                      cardImageSizes={SHOP_GRID_CARD_SIZES}
                      shopListingImage={
                        index === 0 ? "lcp" : index < 3 ? "eager" : "lazy"
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-meta-3">No products match your filters.</p>
              )}

              {totalPages > 1 ? (
                <nav
                  className="mt-10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
                  aria-label="Shop pagination"
                >
                  {currentPage > 1 ? (
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-white grid place-items-center text-sm font-medium text-dark hover:bg-gray-1"
                      aria-label="Previous page"
                    >
                      &lt;
                    </button>
                  ) : (
                    <span
                      className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-gray-1 grid place-items-center text-sm text-meta-4 pointer-events-none"
                      aria-hidden
                    >
                      &lt;
                    </span>
                  )}

                  {paginationItems(currentPage, totalPages).map((item, i) =>
                    item === "ellipsis" ? (
                      <span
                        key={`e-${i}`}
                        className="px-1 text-sm text-meta-4 select-none"
                        aria-hidden
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => goToPage(item)}
                        className={`h-9 min-w-9 px-2 rounded-lg border grid place-items-center text-sm font-medium ${
                          item === currentPage
                            ? "bg-blue text-white border-blue"
                            : "border-gray-3 bg-white text-blue hover:bg-gray-1"
                        }`}
                        aria-current={item === currentPage ? "page" : undefined}
                      >
                        {item}
                      </button>
                    )
                  )}

                  {currentPage < totalPages ? (
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-white grid place-items-center text-sm font-medium text-dark hover:bg-gray-1"
                      aria-label="Next page"
                    >
                      &gt;
                    </button>
                  ) : (
                    <span
                      className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-gray-1 grid place-items-center text-sm text-meta-4 pointer-events-none"
                      aria-hidden
                    >
                      &gt;
                    </span>
                  )}
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
