import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { getBestSellingProducts, getNewArrivalsProduct } from "@/get-api-data/product";
import { HOME_PAGE_REVALIDATE_SECONDS } from "@/lib/cache/homePageCache";
import {
  CATEGORIES_TAG,
  HOME_PAGE_TAG,
  MARKETING_TAG,
  ORDERS_TAG,
  PRODUCT_CATALOG_TAG,
} from "@/lib/cache/tags";
import { onCacheMiss } from "@/lib/observability/cache";

const highlightsIncludeFull = {
  categories: { select: { slug: true, name: true } },
  brands: { select: { slug: true, name: true } },
  products: {
    select: {
      slug: true,
      name: true,
      product_images: { orderBy: { sort_order: "asc" as const }, take: 1, select: { url: true } },
    },
  },
} as const;

const highlightsIncludeFallback = {
  categories: { select: { slug: true, name: true } },
  products: {
    select: {
      slug: true,
      name: true,
      product_images: { orderBy: { sort_order: "asc" as const }, take: 1, select: { url: true } },
    },
  },
} as const;

async function loadHomepageHighlights() {
  try {
    return await prisma.homepage_highlights.findMany({
      orderBy: { sort_order: "asc" },
      include: highlightsIncludeFull,
    });
  } catch {
    return prisma.homepage_highlights.findMany({
      orderBy: { sort_order: "asc" },
      include: highlightsIncludeFallback,
    });
  }
}

async function loadHomePageRawBundle() {
  const [
    siteMarketingSettings,
    categoriesRaw,
    newArrivalsRaw,
    bestSellersRaw,
    slidesRaw,
    highlightsRaw,
    brandRailRaw,
    categoryTilesRaw,
  ] = await Promise.all([
    prisma.site_marketing_settings.findUnique({
      where: { id: SITE_MARKETING_SETTINGS_ID },
      select: {
        highlights_section_eyebrow: true,
        highlights_section_heading: true,
        hero_overlay_eyebrow: true,
        hero_overlay_heading: true,
        hero_overlay_subheading: true,
        hero_overlay_cta_label: true,
        hero_overlay_cta_href: true,
        hero_overlay_eyebrow_color: true,
        hero_overlay_heading_color: true,
        hero_overlay_subheading_color: true,
        hero_overlay_cta_label_color: true,
      },
    }),
    prisma.categories.findMany({
      orderBy: { name: "asc" },
      take: 8,
      select: { id: true, name: true, slug: true },
    }),
    getNewArrivalsProduct(),
    getBestSellingProducts(),
    prisma.homepage_hero_slides.findMany({ orderBy: { sort_order: "asc" } }).catch(() => []),
    loadHomepageHighlights().catch(() => []),
    prisma.homepage_brand_rail
      .findMany({
        orderBy: { sort_order: "asc" },
        include: { brands: { select: { slug: true, name: true } } },
      })
      .catch(() => []),
    prisma.homepage_category_tiles
      .findMany({
        orderBy: { sort_order: "asc" },
        include: { categories: { select: { id: true, name: true, slug: true } } },
      })
      .catch(() => []),
  ]);

  return {
    siteMarketingSettings,
    categoriesRaw,
    newArrivalsRaw,
    bestSellersRaw,
    slidesRaw,
    highlightsRaw,
    brandRailRaw,
    categoryTilesRaw,
  };
}

export type HomePageRawBundle = Awaited<ReturnType<typeof loadHomePageRawBundle>>;

/**
 * Single cached loader for homepage ISR — one parallel batch per cache miss.
 * Product rails reuse `getNewArrivalsProduct` / `getBestSellingProducts` sub-caches when warm.
 */
export const getHomePageData = unstable_cache(
  onCacheMiss("home-page-bundle", loadHomePageRawBundle),
  ["home-page-bundle", "v1"],
  {
    revalidate: HOME_PAGE_REVALIDATE_SECONDS,
    tags: [
      HOME_PAGE_TAG,
      MARKETING_TAG,
      PRODUCT_CATALOG_TAG,
      CATEGORIES_TAG,
      ORDERS_TAG,
    ],
  }
);
