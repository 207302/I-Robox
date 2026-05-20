"use client";

import ProductItem from "@/components/Common/ProductItem";
import { ChevronDown } from "@/components/Header/icons";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import type { ShopListingData } from "@/lib/shop/shopListing";
import {
  SHOP_LISTING_FACETS_PARAM,
  listingFilterFingerprint,
  listingFilterFingerprintFromState,
} from "@/lib/shop/shopListingParams";
import {
  SHOP_QUERY_EVENT,
  applyShopQuery,
  buildListingQueryString,
  paginationItems,
  parseShopQueryString,
  type ShopQueryState,
} from "@/lib/shop/shopQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { filterAndSortProducts, type ProductSearchItem } from "@/lib/search/productSearch";
import {
  completeSearchProgress,
  isSearchProgressPending,
  setSearchProgress,
} from "@/lib/shop/searchProgress";
import { usePathname, useSearchParams } from "next/navigation";
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

type BrandRow = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  initialListing: ShopListingData;
  initialQueryString: string;
  allCategories: CategoryRow[];
  allBrands: BrandRow[];
};

function queryStringFromWindow(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const qs = window.location.search.replace(/^\?/, "");
  return qs || fallback;
}

function filterFingerprintExcludingSearch(queryString: string): string {
  const state = parseShopQueryString(queryString);
  return listingFilterFingerprintFromState({ ...state, q: "" });
}

function prefetchProductsApi(queryString: string, opts?: { facetsOnly?: boolean }) {
  const params = new URLSearchParams(queryString);
  if (opts?.facetsOnly) params.set(SHOP_LISTING_FACETS_PARAM, "0");
  const qs = params.toString();
  void fetch(qs ? `/api/products?${qs}` : "/api/products", { cache: "default" });
}

type ShopListFilterKey =
  | "categorySlugs"
  | "brands"
  | "ageGroups"
  | "diecastScales"
  | "subtypes"
  | "collections"
  | "discounts";

function toggleListValue(values: string[], value: string): string[] {
  const idx = values.indexOf(value);
  if (idx >= 0) return values.filter((v) => v !== value);
  return [...values, value];
}

function buildToggledFilterQueryString(
  baseQueryString: string,
  searchQ: string,
  fieldName: string,
  value: string
): string | null {
  const state = parseShopQueryString(baseQueryString);
  if (state.q.trim()) return null;

  const next: ShopQueryState = { ...state, q: searchQ, page: 1 };
  const listKey = {
    category: "categorySlugs",
    brand: "brands",
    ageGroup: "ageGroups",
    diecastScale: "diecastScales",
    subtype: "subtypes",
    collection: "collections",
    discount: "discounts",
  } as const;
  const key = listKey[fieldName as keyof typeof listKey];
  if (!key) return null;

  const arr = [...next[key]];
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
  next[key] = arr as never;

  return buildListingQueryString(next);
}

export default function ShopLiveExperience({
  initialListing,
  initialQueryString,
  allCategories,
  allBrands,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQueryString = searchParams.toString();
  const [listing, setListing] = useState(initialListing);
  const [queryString, setQueryString] = useState(() =>
    queryStringFromWindow(initialQueryString || urlQueryString)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(() =>
    parseShopQueryString(queryStringFromWindow(initialQueryString)).q
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fetchGenRef = useRef(0);
  const inflightQsRef = useRef<string | null>(null);
  const shellLoadStartedRef = useRef(false);
  const skipListingKeyFetchRef = useRef(true);
  const filterFingerprintRef = useRef(
    listingFilterFingerprint(queryStringFromWindow(initialQueryString))
  );
  const gridRef = useRef<HTMLDivElement | null>(null);
  const prefetchHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedUrlsRef = useRef<Set<string>>(new Set());
  const prevPageScrollRef = useRef(parseShopQueryString(queryStringFromWindow(initialQueryString)).page);
  const clientQueryRef = useRef(queryStringFromWindow(initialQueryString || urlQueryString));
  const [minPriceInput, setMinPriceInput] = useState(
    () => parseShopQueryString(queryStringFromWindow(initialQueryString)).minPrice
  );
  const [maxPriceInput, setMaxPriceInput] = useState(
    () => parseShopQueryString(queryStringFromWindow(initialQueryString)).maxPrice
  );
  const [searchIndex, setSearchIndex] = useState<ProductSearchItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/products/search-index", { cache: "default" })
      .then((res) => res.json())
      .then((data: { items?: ProductSearchItem[] }) => {
        if (!cancelled && Array.isArray(data.items)) setSearchIndex(data.items);
      })
      .catch((err) => console.error("[shop] search index load failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const cancelHoverPrefetch = useCallback(() => {
    if (prefetchHoverTimerRef.current) {
      clearTimeout(prefetchHoverTimerRef.current);
      prefetchHoverTimerRef.current = null;
    }
  }, []);

  const scheduleHoverPrefetch = useCallback(
    (qs: string | null) => {
      cancelHoverPrefetch();
      if (!qs) return;
      prefetchHoverTimerRef.current = setTimeout(() => {
        if (prefetchedUrlsRef.current.has(qs)) return;
        prefetchedUrlsRef.current.add(qs);
        prefetchProductsApi(qs);
      }, 200);
    },
    [cancelHoverPrefetch]
  );

  const prefetchAdjacentPages = useCallback((data: ShopListingData, qs: string) => {
    const state = parseShopQueryString(qs);
    const totalPages = Math.max(1, data.totalPages ?? 1);
    const current = data.page ?? state.page;
    if (current > 1) {
      const prevQs = buildListingQueryString({ ...state, page: current - 1 });
      if (!prefetchedUrlsRef.current.has(prevQs)) {
        prefetchedUrlsRef.current.add(prevQs);
        prefetchProductsApi(prevQs, { facetsOnly: true });
      }
    }
    if (current < totalPages) {
      const nextQs = buildListingQueryString({ ...state, page: current + 1 });
      if (!prefetchedUrlsRef.current.has(nextQs)) {
        prefetchedUrlsRef.current.add(nextQs);
        prefetchProductsApi(nextQs, { facetsOnly: true });
      }
    }
  }, []);

  const query = parseShopQueryString(queryString);
  const activeFilterCount = useMemo(() => countActiveShopFilters(query), [query]);

  useEffect(() => {
    clientQueryRef.current = queryString;
  }, [queryString]);

  useEffect(() => {
    setMinPriceInput(query.minPrice);
    setMaxPriceInput(query.maxPrice);
  }, [query.minPrice, query.maxPrice]);

  const commitQuery = useCallback(
    (next: ShopQueryState) => {
      const qs = buildListingQueryString(next);
      clientQueryRef.current = qs;
      setQueryString(qs);
      applyShopQuery(pathname, qs);
    },
    [pathname]
  );

  const toggleFilter = useCallback(
    (key: ShopListFilterKey, value: string) => {
      commitQuery({
        ...query,
        q: searchInput,
        page: 1,
        [key]: toggleListValue(query[key], value),
      });
    },
    [commitQuery, query, searchInput]
  );

  const toggleCategory = useCallback(
    (slug: string) => {
      const prevSig = [...query.categorySlugs].sort().join("|");
      const nextCategories = toggleListValue(query.categorySlugs, slug);
      const nextSig = [...nextCategories].sort().join("|");
      const categorySetChanged = prevSig !== nextSig;
      commitQuery({
        ...query,
        q: searchInput,
        page: 1,
        categorySlugs: nextCategories,
        ...(categorySetChanged ? { brands: [], subtypes: [], collections: [] } : {}),
      });
    },
    [commitQuery, query, searchInput]
  );

  const toggleBrand = useCallback(
    (slug: string) => {
      toggleFilter("brands", slug);
    },
    [toggleFilter]
  );

  const commitPriceFilters = useCallback(() => {
    commitQuery({
      ...query,
      q: searchInput,
      page: 1,
      minPrice: minPriceInput.trim(),
      maxPrice: maxPriceInput.trim(),
    });
  }, [commitQuery, maxPriceInput, minPriceInput, query, searchInput]);
  /** 250ms debounce for URL sync when index not ready (server search fallback). */
  const debouncedSearchInput = useDebounce(searchInput, 250);

  /** Client fuzzy ids (instant, same algorithm as admin products). */
  const clientFuzzyIds = useMemo(() => {
    const q = searchInput.trim();
    if (!q || searchIndex.length === 0) return null;
    return filterAndSortProducts(searchIndex, q).map((item) => item.id);
  }, [searchInput, searchIndex]);

  const clientMatchCount = clientFuzzyIds !== null ? clientFuzzyIds.length : null;

  const effectiveQueryString = useMemo(() => {
    const parsed = parseShopQueryString(queryString);
    if (clientFuzzyIds !== null) {
      const usp = new URLSearchParams(buildListingQueryString({ ...parsed, q: "" }));
      if (clientFuzzyIds.length > 0) usp.set("ids", clientFuzzyIds.join(","));
      return usp.toString();
    }
    return buildListingQueryString({ ...parsed, q: debouncedSearchInput });
  }, [queryString, clientFuzzyIds, debouncedSearchInput]);

  const debouncedFetchQs = useDebounce(effectiveQueryString, 250);
  const debouncedFilterFpExclQ = useDebounce(filterFingerprintExcludingSearch(queryString), 300);
  const fetchQsRef = useRef(debouncedFetchQs);
  fetchQsRef.current = debouncedFetchQs;
  const listingFetchKey = useMemo(
    () =>
      `${debouncedFilterFpExclQ}|${debouncedFetchQs}|${query.page}|${urlQueryString}`,
    [debouncedFilterFpExclQ, debouncedFetchQs, query.page, urlQueryString]
  );
  const searchPending = searchInput !== debouncedSearchInput || effectiveQueryString !== debouncedFetchQs;
  const gridBusy = searchPending || isLoading;

  const fetchListing = useCallback(async (qs: string) => {
    if (inflightQsRef.current === qs && abortRef.current && !abortRef.current.signal.aborted) {
      return;
    }
    abortRef.current?.abort();
    const gen = ++fetchGenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    inflightQsRef.current = qs;
    setIsLoading(true);
    const trackProgress = isSearchProgressPending();
    if (trackProgress) setSearchProgress(55);
    try {
      const params = new URLSearchParams(qs);
      const fingerprint = listingFilterFingerprint(qs);
      const paginationOnly =
        fingerprint === filterFingerprintRef.current && params.has("page");
      if (paginationOnly) {
        params.set(SHOP_LISTING_FACETS_PARAM, "0");
      } else {
        filterFingerprintRef.current = fingerprint;
      }
      const fetchQs = params.toString();
      const res = await fetch(fetchQs ? `/api/products?${fetchQs}` : "/api/products", {
        signal: controller.signal,
        cache: "default",
      });
      if (trackProgress) setSearchProgress(82);
      const data = (await res.json()) as ShopListingData & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      if (!controller.signal.aborted) {
        setListing((prev) => {
          if (!paginationOnly) return data;
          return {
            ...data,
            ageGroups: data.ageGroups.length ? data.ageGroups : prev.ageGroups,
            diecastScales: data.diecastScales.length ? data.diecastScales : prev.diecastScales,
            brands: data.brands.length ? data.brands : prev.brands,
            productSubtypes: data.productSubtypes.length
              ? data.productSubtypes
              : prev.productSubtypes,
            productCollections: data.productCollections.length
              ? data.productCollections
              : prev.productCollections,
            discountBuckets: data.discountBuckets.length
              ? data.discountBuckets
              : prev.discountBuckets,
          };
        });
        if (trackProgress) completeSearchProgress();
        prefetchAdjacentPages(data, qs);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[shop] listing fetch failed", err);
      if (trackProgress) completeSearchProgress();
    } finally {
      if (gen === fetchGenRef.current) {
        setIsLoading(false);
        inflightQsRef.current = null;
      }
    }
  }, [prefetchAdjacentPages]);

  useEffect(() => {
    return () => cancelHoverPrefetch();
  }, [cancelHoverPrefetch]);

  useEffect(() => {
    const onQuery = (event: Event) => {
      const detail = (event as CustomEvent<{ queryString: string }>).detail;
      const next = detail?.queryString ?? "";
      clientQueryRef.current = next;
      setQueryString(next);
      if (isSearchProgressPending()) {
        void fetchListing(next);
      }
    };
    window.addEventListener(SHOP_QUERY_EVENT, onQuery);
    return () => window.removeEventListener(SHOP_QUERY_EVENT, onQuery);
  }, [fetchListing]);

  useEffect(() => {
    const onPopState = () => {
      const qs = window.location.search.replace(/^\?/, "");
      clientQueryRef.current = qs;
      setQueryString(qs);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Next.js <Link> shop URLs (header, homepage tiles) update the URL without popstate or SHOP_QUERY_EVENT. */
  useEffect(() => {
    if (urlQueryString === clientQueryRef.current) return;
    const windowQs =
      typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    if (urlQueryString !== windowQs) return;
    clientQueryRef.current = urlQueryString;
    setQueryString(urlQueryString);
  }, [urlQueryString]);

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
    const q = parseShopQueryString(queryString).q.trim();
    if (!q && isSearchProgressPending()) {
      completeSearchProgress();
    }
  }, [queryString]);

  /** Empty ISR shell must load products on mount even if filter debounce / Strict Mode races. */
  useEffect(() => {
    if (initialListing.items.length > 0 || shellLoadStartedRef.current) return;
    shellLoadStartedRef.current = true;
    void fetchListing(fetchQsRef.current);
  }, [fetchListing, initialListing.items.length]);

  useEffect(() => {
    if (clientFuzzyIds !== null && clientFuzzyIds.length === 0) {
      setListing((prev) => ({
        ...prev,
        items: [],
        total: 0,
        totalPages: 1,
        page: 1,
      }));
      setIsLoading(false);
      return;
    }
    if (skipListingKeyFetchRef.current) {
      skipListingKeyFetchRef.current = false;
      if (initialListing.items.length === 0) return;
    }
    if (initialListing.items.length > 0 && isSearchProgressPending()) return;
    void fetchListing(fetchQsRef.current);
  }, [listingFetchKey, fetchListing, initialListing.items.length, clientFuzzyIds]);

  useEffect(() => {
    if (prevPageScrollRef.current === query.page) return;
    prevPageScrollRef.current = query.page;
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [query.page]);

  const goToPage = useCallback(
    (page: number) => {
      const nextState: ShopQueryState = { ...query, q: searchInput, page };
      applyShopQuery(pathname, buildListingQueryString(nextState));
    },
    [pathname, query, searchInput]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    clientQueryRef.current = "";
    setQueryString("");
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
  const shopBrands = useMemo(() => {
    const countBySlug = new Map(
      (listing.brands ?? []).map((b) => [b.slug.toLowerCase(), b.count] as const)
    );
    return allBrands
      .map((b) => ({
        slug: b.slug,
        name: b.name,
        count: countBySlug.get(b.slug.toLowerCase()) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [allBrands, listing.brands]);
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

  const filterHoverHandlers = useCallback(
    (fieldName: string, value: string, isChecked: boolean) => ({
      onMouseEnter: () => {
        if (isChecked) return;
        scheduleHoverPrefetch(
          buildToggledFilterQueryString(queryString, debouncedSearchInput, fieldName, value)
        );
      },
      onMouseLeave: cancelHoverPrefetch,
    }),
    [queryString, debouncedSearchInput, scheduleHoverPrefetch, cancelHoverPrefetch]
  );

  const renderFilters = (formId: string, expandSections = false) => {
    const sectionProps = expandSections ? ({ open: true } as const) : {};

    return (
    <div className="rounded-xl border border-gray-3 bg-white p-5">
      <form id={formId} className="mb-5 space-y-3" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, brand, category, SKU…"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
            onBlur={commitPriceFilters}
            placeholder="Min ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <input
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            onBlur={commitPriceFilters}
            placeholder="Max ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </div>
        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Age groups</summary>
          <div className="shop-filter-list-scroll">
          <ul className="space-y-2 pr-1">
            {ageGroups.length === 0 ? (
              <li className="text-meta-4 text-sm">No age groups yet.</li>
            ) : null}
            {ageGroups.map((group) => (
              <li key={group}>
                <label
                  className="flex items-center gap-2 text-sm text-dark-4"
                  {...filterHoverHandlers("ageGroup", group, query.ageGroups.includes(group))}
                >
                  <input
                    type="checkbox"
                    checked={query.ageGroups.includes(group)}
                    onChange={() => toggleFilter("ageGroups", group)}
                  />
                  {group}
                </label>
              </li>
            ))}
          </ul>
          </div>
        </details>

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Categories</summary>
          <div className="shop-filter-list-scroll">
          <ul className="space-y-2 pr-1">
            {allCategories.length > 0 ? (
              allCategories.map((cat) => (
                <li key={cat.id}>
                  <label
                    className="flex cursor-pointer items-start gap-2 text-sm text-dark-4 hover:text-blue"
                    {...filterHoverHandlers(
                      "category",
                      cat.slug,
                      query.categorySlugs.includes(cat.slug)
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={query.categorySlugs.includes(cat.slug)}
                      onChange={() => toggleCategory(cat.slug)}
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
          </div>
        </details>

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Brands</summary>
          <div className="shop-filter-list-scroll">
          <ul className="space-y-2 pr-1">
            {shopBrands.length > 0 ? (
              shopBrands.map((b) => (
                <li key={b.slug}>
                  <label
                    className="flex cursor-pointer items-start gap-2 text-sm text-dark-4 hover:text-blue"
                    {...filterHoverHandlers("brand", b.slug, query.brands.includes(b.slug))}
                  >
                    <input
                      type="checkbox"
                      checked={query.brands.includes(b.slug)}
                      onChange={() => toggleBrand(b.slug)}
                      className="mt-0.5 rounded border-gray-3 text-blue focus:ring-blue"
                    />
                    <span className="leading-snug">
                      {b.name} ({b.count})
                    </span>
                  </label>
                </li>
              ))
            ) : (
              <li className="text-meta-4 text-sm">No brands yet.</li>
            )}
          </ul>
          </div>
        </details>

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Sub categories</summary>
          <div className="shop-filter-list-scroll">
          <ul className="space-y-2 pr-1">
            {productSubtypes.map((s) => (
              <li key={s.slug}>
                <label
                  className="flex cursor-pointer items-start gap-2 text-sm text-dark-4 hover:text-blue"
                  {...filterHoverHandlers("subtype", s.slug, query.subtypes.includes(s.slug))}
                >
                  <input
                    type="checkbox"
                    checked={query.subtypes.includes(s.slug)}
                    onChange={() => toggleFilter("subtypes", s.slug)}
                    className="mt-0.5 rounded border-gray-3 text-blue focus:ring-blue"
                  />
                  <span className="leading-snug">
                    {s.name} ({s.count})
                  </span>
                </label>
              </li>
            ))}
            {productSubtypes.length === 0 ? (
              <li className="text-xs text-meta-4">No sub categories yet.</li>
            ) : null}
          </ul>
          </div>
        </details>

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Collections</summary>
          <div className="shop-filter-list-scroll">
          <ul className="space-y-2 pr-1">
            {productCollections.map((c) => (
              <li key={c.slug}>
                <label
                  className="flex cursor-pointer items-start gap-2 text-sm text-dark-4 hover:text-blue"
                  {...filterHoverHandlers("collection", c.slug, query.collections.includes(c.slug))}
                >
                  <input
                    type="checkbox"
                    checked={query.collections.includes(c.slug)}
                    onChange={() => toggleFilter("collections", c.slug)}
                    className="mt-0.5 rounded border-gray-3 text-blue focus:ring-blue"
                  />
                  <span className="leading-snug">
                    {c.name} ({c.count})
                  </span>
                </label>
              </li>
            ))}
            {productCollections.length === 0 ? (
              <li className="text-xs text-meta-4">No collections yet.</li>
            ) : null}
          </ul>
          </div>
        </details>

        <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Discount</summary>
          <div className="shop-filter-list-scroll">
          <ul className="space-y-2 pr-1">
            {discountBuckets.map((d) => (
              <li key={d.id}>
                <label
                  className="flex items-center gap-2 text-sm text-dark-4"
                  {...filterHoverHandlers("discount", d.id, query.discounts.includes(d.id))}
                >
                  <input
                    type="checkbox"
                    checked={query.discounts.includes(d.id)}
                    onChange={() => toggleFilter("discounts", d.id)}
                  />
                  {d.label} ({d.count})
                </label>
              </li>
            ))}
          </ul>
          </div>
        </details>

        {showScales ? (
          <details {...sectionProps} className="shop-filter-details rounded-lg border border-gray-3 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-dark">Scales</summary>
            <div className="shop-filter-list-scroll">
            <ul className="space-y-2 pr-1">
              {diecastScales.map((s) => (
                <li key={s}>
                  <label
                    className="flex items-center gap-2 text-sm text-dark-4"
                    {...filterHoverHandlers("diecastScale", s, query.diecastScales.includes(s))}
                  >
                    <input
                      type="checkbox"
                      checked={query.diecastScales.includes(s)}
                      onChange={() => toggleFilter("diecastScales", s)}
                    />
                    {s}
                  </label>
                </li>
              ))}
            </ul>
            </div>
          </details>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-meta-3">
          <input
            type="checkbox"
            checked={query.available === "true"}
            onChange={(e) =>
              commitQuery({
                ...query,
                q: searchInput,
                page: 1,
                available: e.target.checked ? "true" : "",
              })
            }
          />
          In stock only
        </label>

        <div>
          <label className="mb-1 block text-sm font-semibold text-dark">Sort by</label>
          <select
            value={query.sort}
            onChange={(e) =>
              commitQuery({
                ...query,
                q: searchInput,
                page: 1,
                sort: e.target.value,
              })
            }
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
            <div className="hidden lg:block lg:sticky lg:top-24">
              {renderFilters("shop-filters-form", true)}
            </div>
          </aside>

          <div className="order-1 min-w-0 flex-1 lg:order-none">
            {query.q.trim() ? (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm text-dark sm:text-base">
                  {clientMatchCount !== null ? (
                    <>
                      Found{" "}
                      <span className="font-semibold">
                        {clientMatchCount} match{clientMatchCount !== 1 ? "es" : ""}
                      </span>{" "}
                      for &ldquo;{query.q}&rdquo;
                    </>
                  ) : (
                    <>
                      Showing results for{" "}
                      <span className="font-semibold">&ldquo;{query.q}&rdquo;</span>
                    </>
                  )}
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
              {gridBusy ? (
                <span className="text-xs font-medium text-meta-3 animate-pulse">Updating…</span>
              ) : null}
            </div>
            <div
              ref={gridRef}
              className={`relative scroll-mt-24 transition-opacity duration-150 ${
                gridBusy ? "opacity-50 pointer-events-none" : "opacity-100"
              }`}
              aria-busy={gridBusy}
            >
              {gridBusy ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                  aria-hidden
                >
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-3 border-t-blue" />
                </div>
              ) : null}
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-7.5 gap-y-9">
                  {productGrid}
                </div>
              ) : !gridBusy ? (
                <p className="text-sm text-meta-3">No products match your filters.</p>
              ) : null}

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
