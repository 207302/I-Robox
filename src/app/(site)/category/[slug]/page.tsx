import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CategoryPageExperience from "@/components/Pages/CategoryPageExperience";
import { getBrands } from "@/get-api-data/brand";
import { getAllCategorySlugs, getCategoryPagePayload } from "@/lib/pages/categoryPageData";
import { buildCategoryListingQuery } from "@/lib/pages/listingPageUtils";
import { getShopListingForApi } from "@/lib/shop/shopListingCache";
import { categoryListingMetaDescription } from "@/lib/seo/categoryMetadata";
import { buildSocialMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryPagePayload(slug);
  if (!data) {
    return { title: "Category not found | i-robox" };
  }
  const title = `Shop ${data.category.name} | i-robox`;
  const description = categoryListingMetaDescription({
    name: data.category.name,
    description: data.category.description,
  });
  return {
    title,
    description,
    ...buildSocialMetadata({ title, description, path: `/category/${data.category.slug}` }),
  };
}

const EMPTY_LISTING = {
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

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const pageData = await getCategoryPagePayload(slug);
  if (!pageData) notFound();

  const brandRaw = sp.brand;
  const initialBrandSlug = Array.isArray(brandRaw)
    ? String(brandRaw[0] ?? "").trim()
    : String(brandRaw ?? "").trim();

  const listingParams = new URLSearchParams(
    buildCategoryListingQuery(pageData.category.slug, {
      brandSlug: initialBrandSlug || undefined,
    })
  );

  const [listingEnvelope, allBrands] = await Promise.all([
    getShopListingForApi(listingParams),
    getBrands(),
  ]);

  const initialListing = listingEnvelope.ok ? listingEnvelope.data : EMPTY_LISTING;

  return (
    <CategoryPageExperience
      page={pageData}
      initialListing={initialListing}
      allBrands={allBrands}
      initialBrandSlug={initialBrandSlug}
    />
  );
}
