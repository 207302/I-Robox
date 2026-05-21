import ShopLiveExperience from "@/components/Shop/ShopLiveExperience";
import ShopLcpPreload from "@/components/Shop/ShopLcpPreload";
import ShopPageFallback from "@/components/Shop/ShopPageFallback";
import { getBrands } from "@/get-api-data/brand";
import { getCategories } from "@/get-api-data/category";
import { getShopListingForApi } from "@/lib/shop/shopListingCache";
import type { ShopListingData } from "@/lib/shop/shopListing";
import { listingSearchParamsFromRecord } from "@/lib/shop/shopListingParams";
import { Suspense } from "react";

export const metadata = {
  title: "Shop | i-Robox",
  description: "Browse toys and games at i-Robox.",
};

/** ISR — default listing is server-rendered; filters refetch via /api/products. */
export const revalidate = 120;

const EMPTY_LISTING: ShopListingData = {
  items: [],
  totalPages: 1,
  ageGroups: [],
  diecastScales: [],
  brands: [],
  productSubtypes: [],
  productCollections: [],
  discountBuckets: [],
  page: 1,
  pageSize: 12,
  total: 0,
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const listingParams = listingSearchParamsFromRecord(sp);
  const initialQueryString = listingParams.toString();

  const [listingEnvelope, allCategories, allBrands] = await Promise.all([
    getShopListingForApi(listingParams),
    getCategories(),
    getBrands(),
  ]);

  const initialListing = listingEnvelope.ok ? listingEnvelope.data : EMPTY_LISTING;

  const lcpImage = initialListing.items[0]?.image ?? null;

  return (
    <>
      <ShopLcpPreload src={lcpImage} />
      <Suspense fallback={<ShopPageFallback />}>
        <ShopLiveExperience
          initialListing={initialListing}
          initialQueryString={initialQueryString}
          allCategories={allCategories}
          allBrands={allBrands}
        />
      </Suspense>
    </>
  );
}
