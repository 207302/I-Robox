"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import ProductItem from "@/components/Common/ProductItem";
import FadeInSection from "@/components/ui/FadeInSection";
import { BadgeCheck } from "@/components/Pages/BrandPageTrustBar";
import BrandPageTrustBar from "@/components/Pages/BrandPageTrustBar";
import PageBreadcrumb from "@/components/Pages/PageBreadcrumb";
import PageHero from "@/components/Pages/PageHero";
import type { BrandCollectionCard, BrandPagePayload } from "@/lib/pages/brandPageData";
import {
  buildBrandListingQuery,
  shopListingItemToProduct,
} from "@/lib/pages/listingPageUtils";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import { cloudinaryCardUrl } from "@/lib/images/cloudinaryDeliver";
import type { ShopListingData } from "@/lib/shop/shopListing";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import { Star } from "lucide-react";

type Props = {
  page: BrandPagePayload;
  initialListing: ShopListingData;
};

export default function BrandPageExperience({ page, initialListing }: Props) {
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [sort, setSort] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { brand, heroImage, logoImage, stats, collections } = page;
  const hasExtraFilters = Boolean(categoryFilter || minPrice || maxPrice);

  const fetchListing = useCallback(
    async (pageNum: number, append: boolean) => {
      const qs = buildBrandListingQuery(brand.slug, {
        page: pageNum,
        sort: sort || undefined,
        categorySlug: categoryFilter || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      });
      const res = await fetch(qs ? `/api/products?${qs}` : `/api/products?brand=${brand.slug}`);
      const data = (await res.json()) as ShopListingData;
      if (!res.ok) throw new Error("Failed to load products");
      setListing((prev) =>
        append
          ? {
              ...data,
              items: [...prev.items, ...data.items],
            }
          : data
      );
    },
    [brand.slug, sort, categoryFilter, minPrice, maxPrice]
  );

  const applyFilters = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchListing(1, false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchListing]);

  const loadMore = useCallback(async () => {
    if (loadingMore || listing.page >= listing.totalPages) return;
    setLoadingMore(true);
    try {
      await fetchListing(listing.page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchListing, listing.page, listing.totalPages, loadingMore]);

  const clearFilters = useCallback(() => {
    if (!hasExtraFilters && !sort) {
      router.push("/shop");
      return;
    }
    setSort("");
    setCategoryFilter("");
    setMinPrice("");
    setMaxPrice("");
    setFiltersOpen(false);
    void (async () => {
      setRefreshing(true);
      try {
        const qs = buildBrandListingQuery(brand.slug);
        const res = await fetch(`/api/products?${qs}`);
        const data = (await res.json()) as ShopListingData;
        if (res.ok) setListing(data);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [brand.slug, hasExtraFilters, router, sort]);

  const productGrid = useMemo(
    () =>
      listing.items.map((item, index) => (
        <ProductItem
          key={item.id}
          item={shopListingItemToProduct(item)}
          cardImageSizes={SHOP_GRID_CARD_SIZES}
          shopListingImage={index === 0 ? "lcp" : index === 1 ? "eager" : "lazy"}
        />
      )),
    [listing.items]
  );

  return (
    <main className="bg-white">
      <PageBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Brands", href: "/shop" },
          { label: brand.name },
        ]}
      />

      <PageHero title={brand.name} heroImage={heroImage} />

      <FadeInSection>
        <section className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
            <div className="flex items-start gap-5 sm:gap-6">
              {logoImage ? (
                <div className="relative size-[120px] shrink-0 overflow-hidden rounded-xl shadow-md">
                  <Image
                    src={logoImage}
                    alt={`${brand.name} logo`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-dark md:text-2xl">{brand.name}</h2>
                  <BadgeCheck className="size-5 text-blue" aria-label="Verified brand" />
                </div>
                {brand.description?.trim() ? (
                  <p className="mt-2 max-w-3xl text-sm text-meta-3 md:text-base">
                    {brand.description}
                  </p>
                ) : null}
                <ul className="mt-4 flex flex-wrap gap-6 text-sm text-dark">
                  <li>
                    <span className="font-semibold">{stats.productCount}+</span> Products
                  </li>
                  <li className="inline-flex items-center gap-1">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                    <span className="font-semibold">{stats.rating ?? "—"}</span> Rating
                  </li>
                  <li>
                    <span className="font-semibold">10K+</span> Happy Customers
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {collections.length > 1 ? (
        <FadeInSection>
          <section className="border-t border-gray-200 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h3 className="text-lg font-bold text-dark md:text-xl">Popular Collections</h3>
                <Link
                  href="/shop"
                  prefetch={shouldPrefetchHref("/shop")}
                  className="text-sm font-medium text-blue hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth snap-x snap-mandatory">
                {collections.map((col: BrandCollectionCard) => (
                  <Link
                    key={col.slug}
                    href={`/category/${encodeURIComponent(col.slug)}?brand=${encodeURIComponent(brand.slug)}`}
                    prefetch={shouldPrefetchHref(
                      `/category/${encodeURIComponent(col.slug)}?brand=${encodeURIComponent(brand.slug)}`
                    )}
                    className="w-44 shrink-0 snap-start sm:w-52"
                  >
                    <div className="overflow-hidden rounded-xl bg-gray-1 shadow-md transition hover:-translate-y-1 hover:shadow-lg">
                      <div className="relative aspect-[4/3] w-full bg-white">
                        {col.image ? (
                          <Image
                            src={cloudinaryCardUrl(col.image, 320)}
                            alt={col.name}
                            fill
                            className="object-cover"
                            sizes="208px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue/20 to-blue-dark/20 text-xs font-medium text-dark">
                            {col.name}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-semibold text-dark">{col.name}</p>
                        <p className="mt-1 text-xs text-meta-3">{col.productCount} products</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </FadeInSection>
      ) : null}

      <FadeInSection>
        <section className="border-t border-gray-200 py-10 pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h3 className="text-xl font-bold text-dark md:text-2xl">
                All {brand.name} Products
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                  }}
                  className="rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                  aria-label="Sort products"
                >
                  <option value="">Popularity</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
                >
                  Filter
                </button>
                <button
                  type="button"
                  onClick={() => void applyFilters()}
                  className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark"
                >
                  Apply
                </button>
                {(hasExtraFilters || sort) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-gray-3 px-4 py-2 text-sm text-meta-3 hover:text-dark"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {filtersOpen ? (
              <div className="mb-6 grid gap-4 rounded-xl border border-gray-3 bg-gray-1 p-4 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-dark">Category</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2"
                  >
                    <option value="">All categories</option>
                    {collections.map((col) => (
                      <option key={col.slug} value={col.slug}>
                        {col.name}
                      </option>
                    ))}
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
            ) : null}

            {refreshing ? (
              <p className="py-8 text-center text-sm text-meta-3">Updating products…</p>
            ) : (
              <div className="brand-product-grid grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:gap-6">
                {productGrid}
              </div>
            )}

            {!refreshing && listing.items.length === 0 ? (
              <p className="py-12 text-center text-sm text-meta-3">No products found for this brand.</p>
            ) : null}

            {listing.page < listing.totalPages ? (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="rounded-lg bg-dark px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </FadeInSection>

      <BrandPageTrustBar />
    </main>
  );
}
