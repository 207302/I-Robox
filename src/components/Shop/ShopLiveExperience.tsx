"use client";

import { AnimatePresence, motion } from "framer-motion";
import ProductItem from "@/components/Common/ProductItem";
import ShopProductGridSkeleton from "@/components/Shop/ShopProductGridSkeleton";
import { ToyLoader } from "@/components/ui/ToyLoader";
import { ChevronDown } from "@/components/Header/icons";
import { LayoutGrid, LayoutList } from "lucide-react";
import {
  readShopMobileGridColumns,
  shopProductGridClassName,
  SHOP_MOBILE_GRID_STORAGE_KEY,
  type ShopMobileGridColumns,
} from "@/lib/shop/shopGridLayout";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import { shopPageHeading } from "@/lib/seo/categoryMetadata";
import type { ShopListingData } from "@/lib/shop/shopListing";
import {
  SHOP_LISTING_FACETS_PARAM,
  SHOP_LISTING_KNOWN_TOTAL_PARAM,
  SHOP_LISTING_NO_FLASH_PARAM,
  listingFilterFingerprint,
  listingFilterFingerprintFromState,
} from "@/lib/shop/shopListingParams";
import {
  resolveShopFilterApplyDestination,
  shopQueryToFilterDraft,
  type ShopFilterDraft,
} from "@/lib/shop/resolveShopFilterApplyDestination";
import {
  SHOP_QUERY_EVENT,
  applyShopQuery,
  buildListingQueryString,
  paginationItems,
  parseShopQueryString,
  type ShopQueryState,
} from "@/lib/shop/shopQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { bindShopFilterScrollbarReveal } from "@/lib/shop/filterScrollbarReveal";
import { SEARCH_DEBOUNCE_MS } from "@/lib/shop/shopConstants";
import { throttle } from "@/lib/perf/throttle";
import type { ProductSearchItem } from "@/lib/search/productSearch";
import {
  completeSearchProgress,
  isSearchProgressPending,
  setSearchProgress,
} from "@/lib/shop/searchProgress";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DIECAST_ONLY_CATEGORY = "toy cars, trains & vehicles";

/** Directional slide for product-grid page transitions. */
const slideVariants = {
  enterFromRight: { x: "100%", opacity: 0 },
  enterFromLeft: { x: "-100%", opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitToLeft: { x: "-100%", opacity: 0 },
  exitToRight: { x: "100%", opacity: 0 },
};

/** 0.3s tween — short enough not to feel laggy on slow networks. */
const slideTransition = {
  x: { type: "tween" as const, ease: "easeInOut" as const, duration: 0.3 },
  opacity: { duration: 0.2 },
};

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
  description?: string | null;
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

function hasActiveListingSearch(
  fetchQs: string,
  searchInput: string,
  clientFuzzyIds: string[] | null
): boolean {
  if (clientFuzzyIds !== null) return true;
  if (searchInput.trim()) return true;
  const usp = new URLSearchParams(fetchQs);
  return Boolean(usp.get("q")?.trim() || usp.get("ids")?.trim());
}

function prefetchProductsApi(
  queryString: string,
  opts?: {
    facetsOnly?: boolean;
    knownTotal?: number;
    noFlash?: boolean;
    signal?: AbortSignal;
  }
) {
  const params = new URLSearchParams(queryString);
  if (opts?.facetsOnly) params.set(SHOP_LISTING_FACETS_PARAM, "0");
  if (opts?.knownTotal != null && opts.knownTotal > 0) {
    params.set(SHOP_LISTING_KNOWN_TOTAL_PARAM, String(opts.knownTotal));
  }
  if (opts?.noFlash) params.set(SHOP_LISTING_NO_FLASH_PARAM, "1");
  const qs = params.toString();
  void fetch(qs ? `/api/products?${qs}` : "/api/products", {
    cache: "default",
    signal: opts?.signal,
  }).catch(() => {
    /* prefetch is best-effort; abort + network failures are non-fatal */
  });
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
  const router = useRouter();
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
  const [mobileGridColumns, setMobileGridColumns] = useState<ShopMobileGridColumns>(() =>
    readShopMobileGridColumns()
  );
  const productsPaneRef = useRef<HTMLDivElement>(null);
  const shopSectionRef = useRef<HTMLElement>(null);
  const desktopSidebarPaneRef = useRef<HTMLDivElement>(null);
  const desktopSidebarScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchGenRef = useRef(0);
  const inflightQsRef = useRef<string | null>(null);
  const shellLoadStartedRef = useRef(false);
  const skipListingKeyFetchRef = useRef(true);
  const skippedSsrRefetchRef = useRef(false);
  const hasVisibleProductsRef = useRef(initialListing.items.length > 0);
  const filterFingerprintRef = useRef(
    listingFilterFingerprint(queryStringFromWindow(initialQueryString))
  );
  const prefetchHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedUrlsRef = useRef<Set<string>>(new Set());
  const listingRef = useRef(initialListing);
  listingRef.current = listing;
  const prevPageScrollRef = useRef(parseShopQueryString(queryStringFromWindow(initialQueryString)).page);
  const clientQueryRef = useRef(queryStringFromWindow(initialQueryString || urlQueryString));
  const [pendingFilters, setPendingFilters] = useState<ShopFilterDraft>(() =>
    shopQueryToFilterDraft(parseShopQueryString(queryStringFromWindow(initialQueryString)))
  );
  const [searchIndex, setSearchIndex] = useState<ProductSearchItem[]>([]);
  const filterProductsRef = useRef<
    ((items: ProductSearchItem[], q: string) => ProductSearchItem[]) | null
  >(null);
  const [searchFilterReady, setSearchFilterReady] = useState(false);

  const setMobileGrid = useCallback((columns: ShopMobileGridColumns) => {
    setMobileGridColumns(columns);
    try {
      localStorage.setItem(SHOP_MOBILE_GRID_STORAGE_KEY, String(columns));
    } catch {
      /* private browsing */
    }
  }, []);

  useEffect(() => {
    void import("@/lib/search/productSearch").then((m) => {
      filterProductsRef.current = m.filterAndSortProducts;
      setSearchFilterReady(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/api/products/search-index", { cache: "default" })
        .then((res) => res.json())
        .then((data: { items?: ProductSearchItem[] }) => {
          if (!cancelled && Array.isArray(data.items)) setSearchIndex(data.items);
        })
        .catch((err) => console.error("[shop] search index load failed", err));
    };
    load();
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

  /** Adjacent prefetches share a single AbortController so unmount cancels in-flight bg requests. */
  const adjacentPrefetchAbortRef = useRef<AbortController | null>(null);

  const prefetchAdjacentPages = useCallback((data: ShopListingData, qs: string) => {
    /** Mobile: viewport too narrow for free RTT; skip background prefetch to save data. */
    if (typeof window !== "undefined" && window.innerWidth < 768) return;

    const state = parseShopQueryString(qs);
    const totalPages = Math.max(1, data.totalPages ?? 1);
    const current = data.page ?? state.page;

    adjacentPrefetchAbortRef.current?.abort();
    const controller = new AbortController();
    adjacentPrefetchAbortRef.current = controller;

    /**
     * Always send noFlash=1 on prefetch — if the prefetched page truly has flash items,
     * the main on-demand fetch (without noFlash) will re-run and overwrite. Background-only.
     */
    const baseOpts = {
      facetsOnly: true as const,
      knownTotal: data.total,
      noFlash: true as const,
      signal: controller.signal,
    };

    if (current > 1) {
      const prevQs = buildListingQueryString({ ...state, page: current - 1 });
      if (!prefetchedUrlsRef.current.has(prevQs)) {
        prefetchedUrlsRef.current.add(prevQs);
        prefetchProductsApi(prevQs, baseOpts);
      }
    }
    if (current < totalPages) {
      const nextQs = buildListingQueryString({ ...state, page: current + 1 });
      if (!prefetchedUrlsRef.current.has(nextQs)) {
        prefetchedUrlsRef.current.add(nextQs);
        prefetchProductsApi(nextQs, baseOpts);
      }
    }
  }, []);

  useEffect(() => {
    return () => adjacentPrefetchAbortRef.current?.abort();
  }, []);

  const query = parseShopQueryString(queryString);
  const activeFilterCount = useMemo(() => countActiveShopFilters(query), [query]);
  const pageHeading = useMemo(
    () => shopPageHeading(query.categorySlugs, allCategories),
    [query.categorySlugs, allCategories]
  );
  const activeCategory =
    query.categorySlugs.length === 1
      ? allCategories.find((c) => c.slug === query.categorySlugs[0])
      : undefined;

  useEffect(() => {
    clientQueryRef.current = queryString;
  }, [queryString]);

  useEffect(() => {
    setPendingFilters(shopQueryToFilterDraft(parseShopQueryString(queryString)));
  }, [queryString]);

  const commitQuery = useCallback(
    (next: ShopQueryState) => {
      const qs = buildListingQueryString(next);
      clientQueryRef.current = qs;
      setQueryString(qs);
      applyShopQuery(pathname, qs);
    },
    [pathname]
  );

  const togglePendingFilter = useCallback((key: ShopListFilterKey, value: string) => {
    setPendingFilters((prev) => ({
      ...prev,
      [key]: toggleListValue(prev[key], value),
    }));
  }, []);

  const togglePendingCategory = useCallback((slug: string) => {
    setPendingFilters((prev) => {
      const prevSig = [...prev.categorySlugs].sort().join("|");
      const nextCategories = toggleListValue(prev.categorySlugs, slug);
      const nextSig = [...nextCategories].sort().join("|");
      const categorySetChanged = prevSig !== nextSig;
      return {
        ...prev,
        categorySlugs: nextCategories,
        ...(categorySetChanged ? { brands: [], subtypes: [], collections: [] } : {}),
      };
    });
  }, []);

  const togglePendingBrand = useCallback((slug: string) => {
    togglePendingFilter("brands", slug);
  }, [togglePendingFilter]);

  const filtersDraftDirty = useMemo(() => {
    const committed = shopQueryToFilterDraft(parseShopQueryString(queryString));
    return (
      listingFilterFingerprintFromState({ ...pendingFilters, q: "", page: 1 }) !==
      listingFilterFingerprintFromState({ ...committed, q: "", page: 1 })
    );
  }, [pendingFilters, queryString]);

  const applyPendingFilters = useCallback(() => {
    const draft: ShopFilterDraft = {
      ...pendingFilters,
      minPrice: pendingFilters.minPrice.trim(),
      maxPrice: pendingFilters.maxPrice.trim(),
    };
    const dest = resolveShopFilterApplyDestination(draft, searchInput);
    setMobileFiltersOpen(false);
    if (dest.type === "brand") {
      router.push(`/brand/${encodeURIComponent(dest.slug)}`);
      return;
    }
    if (dest.type === "category") {
      router.push(`/category/${encodeURIComponent(dest.slug)}`);
      return;
    }
    commitQuery(dest.state);
  }, [commitQuery, pendingFilters, router, searchInput]);
  /** Debounce for URL sync when index not ready (server search fallback). */
  const debouncedSearchInput = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);

  /** Client fuzzy ids (instant, same algorithm as admin products). */
  const clientFuzzyIds = useMemo(() => {
    const q = searchInput.trim();
    if (!q || searchIndex.length === 0) return null;
    const filterProducts = filterProductsRef.current;
    if (!filterProducts) return null;
    return filterProducts(searchIndex, q).map((item) => item.id);
  }, [searchInput, searchIndex, searchFilterReady]);

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

  const debouncedFetchQs = useDebounce(effectiveQueryString, SEARCH_DEBOUNCE_MS);
  /** Client fuzzy ids are instant — skip debounce so the grid matches the match count. */
  const listingFetchQs =
    clientFuzzyIds !== null ? effectiveQueryString : debouncedFetchQs;
  const filterFpExclQ = filterFingerprintExcludingSearch(queryString);
  const debouncedFilterFpExclQ = useDebounce(filterFpExclQ, 300);
  const fetchQsRef = useRef(listingFetchQs);
  fetchQsRef.current = listingFetchQs;
  const listingFetchKey = useMemo(
    () =>
      `${debouncedFilterFpExclQ}|${listingFetchQs}|${query.page}|${urlQueryString}`,
    [debouncedFilterFpExclQ, listingFetchQs, query.page, urlQueryString]
  );
  const searchPending =
    searchInput !== debouncedSearchInput ||
    (clientFuzzyIds === null && effectiveQueryString !== debouncedFetchQs);
  const filtersPending = filterFpExclQ !== debouncedFilterFpExclQ;
  const gridBusy = searchPending || filtersPending || isLoading;

  const fetchListing = useCallback(async (qs: string) => {
    if (inflightQsRef.current === qs && abortRef.current && !abortRef.current.signal.aborted) {
      return;
    }
    abortRef.current?.abort();
    const gen = ++fetchGenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    inflightQsRef.current = qs;
    const params = new URLSearchParams(qs);
    const requestedState = parseShopQueryString(qs);
    const fingerprint = listingFilterFingerprint(qs);
    const paginationOnly =
      fingerprint === filterFingerprintRef.current && params.has("page");
    if (!paginationOnly) {
      setIsLoading(true);
    }
    const trackProgress = isSearchProgressPending();
    if (trackProgress) setSearchProgress(55);
    try {
      if (paginationOnly) {
        params.set(SHOP_LISTING_FACETS_PARAM, "0");
        if (listingRef.current.total > 0) {
          params.set(SHOP_LISTING_KNOWN_TOTAL_PARAM, String(listingRef.current.total));
        }
        /**
         * Skip listing.flashSales (~3s cold) when nothing on the current page is discounted.
         * Server's `discountedPrice` collapses flash and static discounts, so any non-null
         * value is treated conservatively — only skip when the current page is fully un-discounted.
         */
        const currentHasAnyDiscount = listingRef.current.items.some(
          (it) => it.discountedPrice != null
        );
        if (!currentHasAnyDiscount) {
          params.set(SHOP_LISTING_NO_FLASH_PARAM, "1");
        }
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
        const responsePage = data.page ?? requestedState.page;
        if (responsePage !== requestedState.page && (data.total ?? 0) > 0) {
          const correctedQs = buildListingQueryString({
            ...requestedState,
            page: responsePage,
          });
          clientQueryRef.current = correctedQs;
          applyShopQuery(pathname, correctedQs);
          return;
        }
        setListing((prev) => {
          const next = !paginationOnly
            ? data
            : {
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
          if (next.items?.length) hasVisibleProductsRef.current = true;
          return next;
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
  }, [pathname, prefetchAdjacentPages]);

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

  /** Sidebar search: sync debounced q into URL (page 1) so deep links and back/forward stay correct. */
  useEffect(() => {
    const parsed = parseShopQueryString(clientQueryRef.current);
    if (parsed.q === debouncedSearchInput) return;
    const next = buildListingQueryString({ ...parsed, q: debouncedSearchInput, page: 1 });
    clientQueryRef.current = next;
    setQueryString(next);
    applyShopQuery(pathname, next);
  }, [debouncedSearchInput, pathname]);

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
    if (
      !skippedSsrRefetchRef.current &&
      initialListing.items.length > 0 &&
      !hasActiveListingSearch(fetchQsRef.current, searchInput, clientFuzzyIds) &&
      listingFilterFingerprint(fetchQsRef.current) ===
        listingFilterFingerprint(initialQueryString) &&
      parseShopQueryString(fetchQsRef.current).page === (initialListing.page ?? 1)
    ) {
      skippedSsrRefetchRef.current = true;
      return;
    }
    if (
      initialListing.items.length > 0 &&
      isSearchProgressPending() &&
      !hasActiveListingSearch(fetchQsRef.current, searchInput, clientFuzzyIds)
    ) {
      return;
    }
    void fetchListing(fetchQsRef.current);
  }, [listingFetchKey, fetchListing, initialListing.items.length, initialListing.page, initialQueryString, clientFuzzyIds, searchInput]);

  useEffect(() => {
    if (prevPageScrollRef.current === query.page) return;
    prevPageScrollRef.current = query.page;
    productsPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [query.page]);

  /**
   * Directional page-transition state.
   *  - "left"  → next page  (exit left,  enter from right)
   *  - "right" → prev page  (exit right, enter from left)
   * `isPageChangeOnlyRef` gates animation to *pure pagination*; filter/search
   * changes (which may also reset page→1) skip the slide.
   */
  const prevPageDirectionRef = useRef({
    page: query.page,
    fp: listingFilterFingerprint(queryString),
  });
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const isPageChangeOnlyRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    /** Snapshot only after hydration to avoid SSR/client output divergence. */
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const currentFp = listingFilterFingerprint(queryString);
    const prev = prevPageDirectionRef.current;
    if (prev.page !== query.page && prev.fp === currentFp) {
      isPageChangeOnlyRef.current = true;
      setSlideDirection(query.page > prev.page ? "left" : "right");
    } else {
      isPageChangeOnlyRef.current = false;
      setSlideDirection(null);
    }
    prevPageDirectionRef.current = { page: query.page, fp: currentFp };
  }, [query.page, queryString]);

  const totalPages = Math.max(1, listing.totalPages ?? 1);

  const goToPage = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.min(page, totalPages));
      const nextState: ShopQueryState = { ...query, q: searchInput, page: safePage };
      applyShopQuery(pathname, buildListingQueryString(nextState));
    },
    [pathname, query, searchInput, totalPages]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    const emptyDraft: ShopFilterDraft = {
      categorySlugs: [],
      brands: [],
      ageGroups: [],
      diecastScales: [],
      subtypes: [],
      collections: [],
      discounts: [],
      minPrice: "",
      maxPrice: "",
      available: "",
      sort: "",
    };
    setPendingFilters(emptyDraft);
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
  const currentPage = listing.page ?? query.page;
  const gridResultsLoading = gridBusy && products.length > 0;

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
  const selectedCategoryNames = new Set(
    allCategories
      .filter((cat) => pendingFilters.categorySlugs.includes(cat.slug))
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
            brandId: item.brandId ?? null,
            productVariants: item.productVariants,
            product_images: item.product_images,
            image: item.image,
          }}
          key={item.id}
          cardImageSizes={SHOP_GRID_CARD_SIZES}
          shopListingImage={index === 0 ? "lcp" : index === 1 ? "eager" : "lazy"}
        />
      )),
    [products]
  );

  useEffect(() => {
    const productsPane = productsPaneRef.current;
    const sidebarPane = desktopSidebarPaneRef.current;
    const sidebarScroll = desktopSidebarScrollRef.current;
    if (!productsPane || !sidebarPane || !sidebarScroll) return;

    let cancelled = false;

    const clearSidebarHeight = () => {
      sidebarPane.style.height = "";
      sidebarPane.style.maxHeight = "";
      sidebarPane.style.overflow = "";
      sidebarScroll.style.height = "";
      sidebarScroll.style.maxHeight = "";
      sidebarScroll.style.overflowY = "";
    };

    const syncSidebarHeight = () => {
      if (cancelled || window.innerWidth < 1024) {
        clearSidebarHeight();
        return;
      }
      const h = Math.round(productsPane.getBoundingClientRect().height);
      if (h <= 0) return;
      const px = `${h}px`;
      sidebarPane.style.height = px;
      sidebarPane.style.maxHeight = px;
      sidebarPane.style.overflow = "hidden";
      sidebarScroll.style.height = px;
      sidebarScroll.style.maxHeight = px;
      sidebarScroll.style.overflowY = "auto";
    };

    const scheduleSync = () => requestAnimationFrame(syncSidebarHeight);
    const onResize = throttle(scheduleSync, 100);

    const run = () => {
      if (cancelled) return;
      scheduleSync();
      const ro = new ResizeObserver(scheduleSync);
      ro.observe(productsPane);

      const onImgLoad = () => scheduleSync();
      const imgs = productsPane.querySelectorAll("img");
      imgs.forEach((img) => {
        if (!img.complete) img.addEventListener("load", onImgLoad, { once: true });
      });

      window.addEventListener("resize", onResize);

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", onResize);
        imgs.forEach((img) => img.removeEventListener("load", onImgLoad));
        clearSidebarHeight();
      };
    };

    let teardown: (() => void) | undefined;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => {
        teardown = run();
      }, { timeout: 800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
        teardown?.();
        clearSidebarHeight();
      };
    }

    teardown = run();
    return () => {
      cancelled = true;
      teardown?.();
      clearSidebarHeight();
    };
  }, [products.length, totalPages, currentPage, gridBusy, query.q, clientMatchCount]);

  useEffect(() => bindShopFilterScrollbarReveal(shopSectionRef.current), []);

  const pendingQueryString = useMemo(
    () =>
      buildListingQueryString({
        ...pendingFilters,
        q: debouncedSearchInput,
        page: 1,
      }),
    [pendingFilters, debouncedSearchInput]
  );

  const filterHoverHandlers = useCallback(
    (fieldName: string, value: string, isChecked: boolean) => ({
      onMouseEnter: () => {
        if (isChecked) return;
        scheduleHoverPrefetch(
          buildToggledFilterQueryString(
            pendingQueryString,
            debouncedSearchInput,
            fieldName,
            value
          )
        );
      },
      onMouseLeave: cancelHoverPrefetch,
    }),
    [pendingQueryString, debouncedSearchInput, scheduleHoverPrefetch, cancelHoverPrefetch]
  );

  const renderApplyFiltersButton = () => (
    <button
      type="button"
      onClick={applyPendingFilters}
      disabled={!filtersDraftDirty}
      className="block w-full rounded-lg bg-blue px-4 py-2 text-center text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Apply filters
    </button>
  );

  const renderFilters = (formId: string, expandSections = false) => {
    const sectionProps = expandSections ? ({ open: true } as const) : {};

    return (
    <div className="rounded-xl border border-gray-3 bg-white p-5">
      <h2 className="sr-only">Filter products</h2>
      <form id={formId} className="mb-5 space-y-3" onSubmit={(e) => e.preventDefault()}>
        {renderApplyFiltersButton()}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={pendingFilters.minPrice}
            onChange={(e) =>
              setPendingFilters((prev) => ({ ...prev, minPrice: e.target.value }))
            }
            placeholder="Min ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <input
            value={pendingFilters.maxPrice}
            onChange={(e) =>
              setPendingFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
            }
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
                  {...filterHoverHandlers("ageGroup", group, pendingFilters.ageGroups.includes(group))}
                >
                  <input
                    type="checkbox"
                    checked={pendingFilters.ageGroups.includes(group)}
                    onChange={() => togglePendingFilter("ageGroups", group)}
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
                      pendingFilters.categorySlugs.includes(cat.slug)
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={pendingFilters.categorySlugs.includes(cat.slug)}
                      onChange={() => togglePendingCategory(cat.slug)}
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
                    {...filterHoverHandlers("brand", b.slug, pendingFilters.brands.includes(b.slug))}
                  >
                    <input
                      type="checkbox"
                      checked={pendingFilters.brands.includes(b.slug)}
                      onChange={() => togglePendingBrand(b.slug)}
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
                  {...filterHoverHandlers("subtype", s.slug, pendingFilters.subtypes.includes(s.slug))}
                >
                  <input
                    type="checkbox"
                    checked={pendingFilters.subtypes.includes(s.slug)}
                    onChange={() => togglePendingFilter("subtypes", s.slug)}
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
                  {...filterHoverHandlers("collection", c.slug, pendingFilters.collections.includes(c.slug))}
                >
                  <input
                    type="checkbox"
                    checked={pendingFilters.collections.includes(c.slug)}
                    onChange={() => togglePendingFilter("collections", c.slug)}
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
                  {...filterHoverHandlers("discount", d.id, pendingFilters.discounts.includes(d.id))}
                >
                  <input
                    type="checkbox"
                    checked={pendingFilters.discounts.includes(d.id)}
                    onChange={() => togglePendingFilter("discounts", d.id)}
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
                    {...filterHoverHandlers("diecastScale", s, pendingFilters.diecastScales.includes(s))}
                  >
                    <input
                      type="checkbox"
                      checked={pendingFilters.diecastScales.includes(s)}
                      onChange={() => togglePendingFilter("diecastScales", s)}
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
            checked={pendingFilters.available === "true"}
            onChange={(e) =>
              setPendingFilters((prev) => ({
                ...prev,
                available: e.target.checked ? "true" : "",
              }))
            }
          />
          In stock only
        </label>

        <div>
          <label className="mb-1 block text-sm font-semibold text-dark">Sort by</label>
          <select
            value={pendingFilters.sort}
            onChange={(e) =>
              setPendingFilters((prev) => ({ ...prev, sort: e.target.value }))
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

        {renderApplyFiltersButton()}
      </form>
    </div>
    );
  };

  return (
    <section ref={shopSectionRef} className="py-10 pb-20">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-dark">{pageHeading}</h1>
            {activeCategory?.description?.trim() ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-meta-3">
                {activeCategory.description.trim()}
              </p>
            ) : null}
          </div>
          {gridResultsLoading ? (
            <span className="text-xs font-medium text-meta-3 animate-pulse">Updating results…</span>
          ) : null}
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, brand, category, SKU…"
            autoComplete="off"
            aria-label="Search products"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </div>

        <div className="shop-mobile-filters-wrap">
          <button
            type="button"
            className="shop-filters-mobile-toggle"
            aria-label={
              activeFilterCount > 0
                ? `Shop filters, ${activeFilterCount} active`
                : "Shop filters"
            }
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

        <div className="shop-mobile-grid-toggle-wrap mb-4 flex items-center justify-end gap-2 lg:hidden">
          <span className="text-sm font-medium text-meta-3">View</span>
          <div
            className="inline-flex rounded-lg border border-gray-3 bg-white p-0.5"
            role="group"
            aria-label="Product grid layout"
          >
            <button
              type="button"
              onClick={() => setMobileGrid(1)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                mobileGridColumns === 1
                  ? "bg-blue text-white"
                  : "text-dark hover:bg-gray-1"
              }`}
              aria-label="One product per row"
              aria-pressed={mobileGridColumns === 1}
            >
              <LayoutList className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMobileGrid(2)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                mobileGridColumns === 2
                  ? "bg-blue text-white"
                  : "text-dark hover:bg-gray-1"
              }`}
              aria-label="Two products per row"
              aria-pressed={mobileGridColumns === 2}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="shop-page-columns flex flex-col gap-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
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

            <div
              ref={productsPaneRef}
              className="relative scroll-mt-24"
              aria-busy={gridBusy}
            >
              {gridBusy ? (
                <div
                  className={
                    gridResultsLoading
                      ? "absolute top-0 left-0 right-0 z-20"
                      : "mb-6 h-11 shrink-0"
                  }
                >
                  <ToyLoader aria-label="Loading products" />
                </div>
              ) : null}
              <div
                className={
                  gridResultsLoading ? "shop-search-results-grid-dim transition-opacity duration-200" : ""
                }
              >
              <h2 className="sr-only">Products</h2>
              {products.length > 0 ? (
                <div className="relative pb-8">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={listing.page}
                      variants={slideVariants}
                      initial={
                        prefersReducedMotion || !isPageChangeOnlyRef.current
                          ? false
                          : slideDirection === "left"
                            ? "enterFromRight"
                            : slideDirection === "right"
                              ? "enterFromLeft"
                              : false
                      }
                      animate="center"
                      exit={
                        prefersReducedMotion || !isPageChangeOnlyRef.current
                          ? undefined
                          : slideDirection === "left"
                            ? "exitToLeft"
                            : "exitToRight"
                      }
                      transition={slideTransition}
                      className={shopProductGridClassName(mobileGridColumns)}
                    >
                      {productGrid}
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : gridBusy ? (
                <ShopProductGridSkeleton count={listing.pageSize || 12} mobileColumns={mobileGridColumns} />
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

          <aside className="shop-desktop-filters-aside lg:col-start-1 lg:row-start-1">
            <div ref={desktopSidebarPaneRef} className="shop-desktop-sidebar-pane">
              <div ref={desktopSidebarScrollRef} className="shop-desktop-sidebar-scroll pb-8">
                {renderFilters("shop-filters-form", true)}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
