import ShopLiveExperience from "@/components/Shop/ShopLiveExperience";
import ShopLcpPreload from "@/components/Shop/ShopLcpPreload";
import { getBrands } from "@/get-api-data/brand";
import { getCategories } from "@/get-api-data/category";
import { getShopListingForApi } from "@/lib/shop/shopListingCache";
import type { ShopListingData } from "@/lib/shop/shopListing";
import { listingSearchParamsFromRecord } from "@/lib/shop/shopListingParams";
import { getShopListingLcpImageUrl } from "@/lib/shop/productCardImage";
import type { Metadata } from "next";
import { JsonLdScript } from "@/lib/seo/jsonLd";
import { absoluteSeoUrl, buildSocialMetadata, truncateMetaDescription } from "@/lib/seo/metadata";
import { categoryListingMetaDescription } from "@/lib/seo/categoryMetadata";

/** ISR — default listing is server-rendered; filters refetch via /api/products. */
export const revalidate = 300;

const SHOP_TITLE_DEFAULT = "Shop RC Toys & Diecast Models | i-robox";
const SHOP_DESCRIPTION_DEFAULT =
  "Browse RC toys, diecast models, and collectibles at i-robox. Filter by category, brand, and price with secure checkout across India.";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const categorySlugs = (() => {
    const raw = sp.category;
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [raw]).map((v) => String(v).trim()).filter(Boolean);
  })();

  let title = SHOP_TITLE_DEFAULT;
  let description = SHOP_DESCRIPTION_DEFAULT;

  if (categorySlugs.length === 1) {
    const categories = await getCategories();
    const match = categories.find((c) => c.slug === categorySlugs[0]);
    if (match) {
      title = `Shop ${match.name} | i-robox`;
      description = categoryListingMetaDescription(match);
    }
  } else if (categorySlugs.length > 1) {
    description = truncateMetaDescription(
      `Shop selected categories at i-robox — RC toys, diecast models, and collectibles with filters and secure checkout.`,
      155
    );
  }

  const query = listingSearchParamsFromRecord(sp).toString();
  const path = query ? `/shop?${query}` : "/shop";

  return {
    title,
    description,
    ...buildSocialMetadata({ title, description, path }),
  };
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
  const lcpProductImage = initialListing.items[0]
    ? getShopListingLcpImageUrl(initialListing.items[0])
    : null;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "i-robox Shop",
    url: absoluteSeoUrl(initialQueryString ? `/shop?${initialQueryString}` : "/shop"),
    numberOfItems: initialListing.total,
    itemListElement: initialListing.items.slice(0, 12).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteSeoUrl(`/shop/${item.slug}`),
      name: item.title,
    })),
  };

  return (
    <>
      <JsonLdScript id="shop-itemlist-jsonld" data={itemListJsonLd} />
      <ShopLcpPreload src={lcpProductImage} />
      <ShopLiveExperience
        initialListing={initialListing}
        initialQueryString={initialQueryString}
        allCategories={allCategories}
        allBrands={allBrands}
      />
    </>
  );
}
