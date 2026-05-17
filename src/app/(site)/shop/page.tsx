import LcpImagePrelink from "@/components/Common/LcpImagePrelink";
import ShopLiveExperience from "@/components/Shop/ShopLiveExperience";
import { getCategories } from "@/get-api-data/category";
import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import type { ShopListingData } from "@/lib/shop/shopListing";
import { getShopListingForApi } from "@/lib/shop/shopListingCache";
import { buildListingQueryString } from "@/lib/shop/shopQuery";
import { withPagePerf } from "@/lib/observability/route";

export const metadata = {
  title: "Shop | i-Robox",
  description: "Browse toys and games at i-Robox.",
};

/** ISR: cache shop SSR listing; revalidate every 30s. */
export const revalidate = 30;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pickMulti(sp: Record<string, string | string[] | undefined>, key: string): string[] {
  const raw = sp[key];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((s) => s.trim()).filter(Boolean))];
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function searchParamsToQueryString(sp: Record<string, string | string[] | undefined>) {
  const sortRaw = pickString(sp.sort).trim();
  const sort = sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : "";
  const page = Number(pickString(sp.page) || "1");
  return buildListingQueryString({
    q: pickString(sp.q).trim(),
    categorySlugs: pickMulti(sp, "category"),
    brands: pickMulti(sp, "brand"),
    ageGroups: pickMulti(sp, "ageGroup"),
    diecastScales: pickMulti(sp, "diecastScale"),
    subtypes: pickMulti(sp, "subtype"),
    collections: pickMulti(sp, "collection"),
    discounts: pickMulti(sp, "discount"),
    minPrice: pickString(sp.minPrice).trim(),
    maxPrice: pickString(sp.maxPrice).trim(),
    available: pickString(sp.available).trim(),
    sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  });
}

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

export default async function ShopPage({ searchParams }: Props) {
  return withPagePerf("page:/shop", async () => {
  const sp = await searchParams;
  const initialQueryString = searchParamsToQueryString(sp);
  const listingParams = new URLSearchParams(initialQueryString);

  const [allCategories, listingEnvelope] = await Promise.all([
    getCategories(),
    getShopListingForApi(listingParams),
  ]);

  const initialListing =
    listingEnvelope.ok && listingEnvelope.data ? listingEnvelope.data : EMPTY_LISTING;
  const lcpPreloadUrl =
    initialListing.items.length > 0
      ? getProductCardImageUrl(initialListing.items[0])
      : "";

  return (
    <>
      <LcpImagePrelink
        imageUrl={lcpPreloadUrl}
        sizes={SHOP_GRID_CARD_SIZES}
        width={640}
        height={640}
      />
      <ShopLiveExperience
        initialListing={initialListing}
        initialQueryString={initialQueryString}
        allCategories={allCategories}
      />
    </>
  );
  });
}
