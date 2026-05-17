"use client";

import ProductItem from "@/components/Common/ProductItem";
import { ChevronDown } from "@/components/Header/icons";
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
import {
  completeSearchProgress,
  isSearchProgressPending,
  setSearchProgress,
} from "@/lib/shop/searchProgress";
import { usePathname } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DIECAST_ONLY_CATEGORY = "toy cars, trains & vehicles";

function countActiveShopFilters(q: ShopQueryState): number {
  let n = 0;
  if (q.q.trim()) n++;
  if (q.minPrice.trim() || q.maxPrice.trim()) n++;
  n += q.categorySlugs.length;
  n += q.brands.length;
  n += q.ageGroups.length;
  n += q.diecastScales.length;
  n += q.subtypes.length;
  n += q.collections.length;
  n += q.discounts.length;
  if (q.available === "true") n++;
  if (q.sort) n++;
  return n;
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(
    () => parseShopQueryString(initialQueryString).q
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipFetchRef = useRef(true);

  const query = parseShopQueryString(queryString);
  const activeFilterCount = useMemo(() => countActiveShopFilters(query), [query]);
  const debouncedSearchInput = useDebounce(searchInput, 350);
  const effectiveQueryString = useMemo(() => {
    const parsed = parseShopQueryString(queryString);
    return buildListingQueryString({ ...parsed, q: debouncedSearchInput });
  }, [queryString, debouncedSearchInput]);
  const searchPending = searchInput !== debouncedSearchInput;

  const fetchListing = useCallback(async (qs: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    const trackProgress = isSearchProgressPending();
    if (trackProgress) setSearchProgress(55);
    try {
      const res = await fetch(qs ? `/api/products?${qs}` : "/api/products", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (trackProgress) setSearchProgress(82);
      const data = (await res.json()) as ShopListingData & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      if (!controller.signal.aborted) {
        setListing(data);
        if (trackProgress) completeSearchProgress();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[shop] listing fetch failed", err);
      if (trackProgress) completeSearchProgress();
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const onQuery = (event: Event) => {
      const detail = (event as CustomEvent<{ queryString: string }>).detail;
      const next = detail?.queryString ?? "";
      startTransition(() => setQueryString(next));
      if (isSearchProgressPending()) {
        skipFetchRef.current = false;
        void fetchListing(next);
      }
    };
    window.addEventListener(SHOP_QUERY_EVENT, onQuery);
    return () => window.removeEventListener(SHOP_QUERY_EVENT, onQuery);
  }, [fetchListing]);

  useEffect(() => {
    const onPopState = () => {
      const qs = window.location.search.replace(/^\?/, "");
      startTransition(() => setQueryString(qs));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const q = parseShopQueryString(queryString).q;
    setSearchInput((prev) => (prev === q ? prev : q));
  }, [queryString]);

  useEffect(() => {
    startTransition(() => {
      setQueryString((prev) => {
        const parsed = parseShopQueryString(prev);
        if (parsed.q === debouncedSearchInput) return prev;
        return buildListingQueryString({ ...parsed, q: debouncedSearchInput, page: 1 });
      });
    });
  }, [debouncedSearchInput]);

  useEffect(() => {
    if (!isSearchProgressPending()) return;
    setSearchProgress(48);
    const immediateQs = buildListingQueryString(parseShopQueryString(queryString));
    void fetchListing(immediateQs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when shop mounts after header search
  }, []);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      if (effectiveQueryString === initialQueryString) return;
    }
    if (isSearchProgressPending()) return;
    void fetchListing(effectiveQueryString);
  }, [effectiveQueryString, fetchListing, initialQueryString]);

  const goToPage = useCallback(
    (page: number) => {
      const nextState: ShopQueryState = { ...query, page };
      applyShopQuery(pathname, buildListingQueryString(nextState));
    },
    [pathname, query]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    applyShopQuery(pathname, "");
  }, [pathname]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    const nextState: ShopQueryState = { ...query, q: "", page: 1 };
    applyShopQuery(pathname, buildListingQueryString(nextState));
  }, [pathname, query]);

  const products = listing.items ?? [];
  const totalPages = Math.max(1, listing.totalPages ?? 1);
  const currentPage = listing.page ?? query.page;
  const ageGroups = listing.ageGroups ?? [];
  const diecastScales = listing.diecastScales ?? [];
  const shopBrands = listing.brands ?? [];
  const productSubtypes = listing.productSubtypes ?? [];
  const productCollections = listing.productCollections ?? [];
  const discountBuckets = listing.discountBuckets ?? [];
  const hasCategorySelection = query.categorySlugs.length > 0;
  const selectedCategoryNames = new Set(
    allCategories
      .filter((cat) => query.categorySlugs.includes(cat.slug))
      .map((cat) => (cat.name ?? cat.title ?? "").trim().toLowerCase())
  );
  const showScales = selectedCategoryNames.has(DIECAST_ONLY_CATEGORY);

  const productGrid = useMemo(
    () =>
      products.map((item, index) => (
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
          shopListingImage={index === 0 ? "lcp" : index < 3 ? "eager" : "lazy"}
        />
      )),
    [products]
  );

  const renderFilters = (formId: string, expandSections = false) => {
    const sectionProps = expandSections ? ({ open: true } as const) : {};

    return (
    <div className="rounded-xl border border-gray-3 bg-white p-5">
      <form id={formId} className="mb-5 space-y-3" onSubmit={(e) => e.preventDefault()}>
        <LiveShopFilters formId={formId} queryString={queryString} />
        <input
          name="q"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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
        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
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

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
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

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
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

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Sub categories</summary>
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
            {!hasCategorySelection ? (
              <li className="text-xs text-meta-4">Select categories to narrow sub categories.</li>
            ) : null}
          </ul>
        </details>

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
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

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
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
          <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
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
  };

  return (
    <section className="overflow-hidden py-10 pb-20">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="order-2 w-full shrink-0 lg:order-none lg:w-64">
            <div className="lg:hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-3 bg-white px-4 py-3.5 text-left text-sm font-semibold text-dark"
                aria-expanded={mobileFiltersOpen}
                aria-controls="shop-filters-mobile-panel"
                onClick={() => setMobileFiltersOpen((open) => !open)}
              >
                <span className="flex items-center gap-2">
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full bg-blue px-2 py-0.5 text-xs font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${mobileFiltersOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <ChevronDown />
                </span>
              </button>
              {mobileFiltersOpen ? (
                <div id="shop-filters-mobile-panel" className="shop-filters-mobile-panel mt-3">
                  {renderFilters("shop-filters-form-mobile")}
                </div>
              ) : null}
            </div>
            <div className="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
              {renderFilters("shop-filters-form", true)}
            </div>
          </aside>

          <div className="order-1 min-w-0 flex-1 lg:order-none">
            {query.q.trim() ? (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm text-dark sm:text-base">
                  Showing results for{" "}
                  <span className="font-semibold">&ldquo;{query.q}&rdquo;</span>
                </p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="shrink-0 self-start text-sm font-medium text-blue underline-offset-2 hover:underline sm:self-center"
                >
                  Clear search
                </button>
              </div>
            ) : null}
            <div className="mb-6 flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-dark">Shop</h1>
              {searchPending || isLoading ? (
                <span className="text-xs font-medium text-meta-3 animate-pulse">Updating…</span>
              ) : null}
            </div>
            {searchPending || isLoading ? (
              <div
                className="mb-4 h-0.5 w-full overflow-hidden rounded-full bg-gray-2"
                role="status"
                aria-label="Loading products"
              >
                <div className="h-full w-1/3 animate-pulse rounded-full bg-blue" />
              </div>
            ) : null}
            <div
              className={`transition-opacity duration-150 ${
                searchPending || isLoading ? "opacity-40" : "opacity-100"
              }`}
              aria-busy={searchPending || isLoading}
            >
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-7.5 gap-y-9">
                  {productGrid}
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
