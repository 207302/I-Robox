"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLoadMoreSentinel } from "@/hooks/useLoadMoreSentinel";
import ProductItem from "@/components/Common/ProductItem";
import FadeInSection from "@/components/ui/FadeInSection";
import PageBreadcrumb from "@/components/Pages/PageBreadcrumb";
import CategoryPageHero from "@/components/Pages/CategoryPageHero";
import type { CategoryPagePayload } from "@/lib/pages/categoryPageData";
import {
  buildCategoryListingQuery,
  shopListingItemToProduct,
} from "@/lib/pages/listingPageUtils";
import type { ShopListingData } from "@/lib/shop/shopListing";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";

type BrandRow = { id: string; slug: string; name: string };

type Props = {
  page: CategoryPagePayload;
  initialListing: ShopListingData;
  allBrands: BrandRow[];
  initialBrandSlug?: string;
};

export default function CategoryPageExperience({
  page,
  initialListing,
  allBrands,
  initialBrandSlug = "",
}: Props) {
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [sort, setSort] = useState("");
  const [brandFilter, setBrandFilter] = useState(initialBrandSlug);
  const [subtypeFilter, setSubtypeFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { category, heroImage, stats, subcategories } = page;
  const hasExtraFilters = Boolean(brandFilter || subtypeFilter || minPrice || maxPrice || sort);

  const fetchListing = useCallback(
    async (pageNum: number, append: boolean) => {
      const qs = buildCategoryListingQuery(category.slug, {
        page: pageNum,
        sort: sort || undefined,
        brandSlug: brandFilter || undefined,
        subtypeSlug: subtypeFilter || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      });
      const res = await fetch(`/api/products?${qs}`);
      const data = (await res.json()) as ShopListingData;
      if (!res.ok) throw new Error("Failed to load products");
      setListing((prev) =>
        append ? { ...data, items: [...prev.items, ...data.items] } : data
      );
    },
    [category.slug, sort, brandFilter, subtypeFilter, minPrice, maxPrice]
  );

  const applyFilters = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchListing(1, false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchListing]);

  const loadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || listing.page >= listing.totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchListing(listing.page + 1, true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchListing, listing.page, listing.totalPages]);

  const hasMorePages = listing.page < listing.totalPages;
  const loadMoreSentinelRef = useLoadMoreSentinel(loadMore, hasMorePages, listing.page);

  const clearFilters = useCallback(() => {
    if (!hasExtraFilters) {
      router.push("/shop");
      return;
    }
    setSort("");
    setBrandFilter("");
    setSubtypeFilter("");
    setMinPrice("");
    setMaxPrice("");
    void (async () => {
      setRefreshing(true);
      try {
        const qs = buildCategoryListingQuery(category.slug);
        const res = await fetch(`/api/products?${qs}`);
        const data = (await res.json()) as ShopListingData;
        if (res.ok) setListing(data);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [category.slug, hasExtraFilters, router]);

  const subtypeOptions = useMemo(
    () => listing.productSubtypes ?? [],
    [listing.productSubtypes]
  );

  const productGrid = useMemo(
    () =>
      listing.items.map((item, index) => (
        <ProductItem
          key={item.id}
          item={shopListingItemToProduct(item)}
          cardImageSizes={SHOP_GRID_CARD_SIZES}
          shopListingImage={index === 0 ? "lcp" : index === 1 ? "eager" : "lazy"}
          hideMobileCartButton
        />
      )),
    [listing.items]
  );

  return (
    <main className="bg-white">
      <PageBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: category.name },
        ]}
      />

      <CategoryPageHero
        title={category.name}
        description={category.description}
        heroImage={heroImage}
      />

      <FadeInSection>
        <section className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
            <p className="text-sm text-dark">
              <span className="font-semibold">{stats.productCount}+</span> Products
            </p>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="border-t border-gray-200 py-10 pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h3 className="text-xl font-bold text-dark md:text-2xl">{category.name}</h3>
            </div>

            <div className="mb-6 rounded-xl border border-gray-3 bg-gray-1 p-4">
              <p className="mb-3 text-sm font-semibold text-dark">Filter by</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {subcategories.length > 0 ? (
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-dark">Sub-category</span>
                    <select
                      value=""
                      onChange={(e) => {
                        const slug = e.target.value;
                        if (slug) router.push(`/category/${encodeURIComponent(slug)}`);
                      }}
                      className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                    >
                      <option value="">This category</option>
                      {subcategories.map((sub) => (
                        <option key={sub.id} value={sub.slug}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-dark">Brand</span>
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                  >
                    <option value="">All brands</option>
                    {allBrands.map((b) => (
                      <option key={b.id} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                {subtypeOptions.length > 0 ? (
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-dark">Type</span>
                    <select
                      value={subtypeFilter}
                      onChange={(e) => setSubtypeFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                    >
                      <option value="">All types</option>
                      {subtypeOptions.map((st) => (
                        <option key={st.slug} value={st.slug}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-dark">Sort by</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                  >
                    <option value="">Newest</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-dark">Min price (₹)</span>
                  <input
                    type="number"
                    min={0}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-dark">Max price (₹)</span>
                  <input
                    type="number"
                    min={0}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void applyFilters()}
                  className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-gray-3 px-4 py-2 text-sm text-meta-3 hover:text-dark"
                >
                  Clear filters
                </button>
              </div>
            </div>

            {refreshing ? (
              <p className="py-8 text-center text-sm text-meta-3">Updating products…</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:gap-6">
                {productGrid}
              </div>
            )}

            {!refreshing && listing.items.length === 0 ? (
              <p className="py-12 text-center text-sm text-meta-3">No products in this category yet.</p>
            ) : null}

            {hasMorePages ? (
              <div
                ref={loadMoreSentinelRef}
                className="mt-6 flex min-h-12 items-center justify-center py-6"
                aria-hidden={!loadingMore}
              >
                {loadingMore ? (
                  <p className="text-sm font-medium text-meta-3" aria-live="polite">
                    Loading more products…
                  </p>
                ) : (
                  <span className="sr-only">Scroll for more products</span>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </FadeInSection>
    </main>
  );
}
