import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BrandPageExperience from "@/components/Pages/BrandPageExperience";
import { getAllBrandSlugs, getBrandPagePayload } from "@/lib/pages/brandPageData";
import { buildBrandListingQuery } from "@/lib/pages/listingPageUtils";
import { getShopListingForApi } from "@/lib/shop/shopListingCache";
import { buildSocialMetadata, truncateMetaDescription } from "@/lib/seo/metadata";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getAllBrandSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBrandPagePayload(slug);
  if (!data) {
    return { title: "Brand not found | i-robox" };
  }
  const title = `${data.brand.name} | i-robox`;
  const description = truncateMetaDescription(data.blurb, 155);
  return {
    title,
    description,
    ...buildSocialMetadata({ title, description, path: `/brand/${data.brand.slug}` }),
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

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const pageData = await getBrandPagePayload(slug);
  if (!pageData) notFound();

  const listingParams = new URLSearchParams(buildBrandListingQuery(pageData.brand.slug));
  const [listingEnvelope] = await Promise.all([
    getShopListingForApi(listingParams),
  ]);

  const initialListing = listingEnvelope.ok ? listingEnvelope.data : EMPTY_LISTING;

  return (
    <BrandPageExperience page={pageData} initialListing={initialListing} />
  );
}
