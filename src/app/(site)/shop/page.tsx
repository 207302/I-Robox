import ShopLiveExperience from "@/components/Shop/ShopLiveExperience";
import { getCategories } from "@/get-api-data/category";
import type { ShopListingData } from "@/lib/shop/shopListing";
import { Suspense } from "react";

export const metadata = {
  title: "Shop | i-Robox",
  description: "Browse toys and games at i-Robox.",
};

/** ISR shell — listing and filters load client-side via /api/products. */
export const revalidate = 60;

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

export default async function ShopPage() {
  const allCategories = await getCategories();

  return (
    <Suspense
      fallback={
        <section className="overflow-hidden py-10 pb-20" aria-busy="true" aria-label="Loading shop" />
      }
    >
      <ShopLiveExperience
        initialListing={EMPTY_LISTING}
        initialQueryString=""
        allCategories={allCategories}
      />
    </Suspense>
  );
}
