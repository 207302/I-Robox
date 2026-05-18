import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getAdminProductPickerList,
  getBrandsForAdmin,
  getCategoriesForAdmin,
} from "@/lib/queries/catalog";
import { getSiteMarketingSettings } from "@/lib/queries/marketing";
import {
  ANNOUNCEMENTS_TAG,
  BRANDS_TAG,
  HOME_PAGE_TAG,
  MARKETING_TAG,
  PRODUCT_CATALOG_TAG,
} from "@/lib/cache/tags";

const highlightsIncludeFull = {
  categories: { select: { id: true, name: true, slug: true } },
  products: { select: { id: true, name: true, slug: true } },
  brands: { select: { id: true, name: true, slug: true } },
} as const;

const highlightsIncludeFallback = {
  categories: { select: { id: true, name: true, slug: true } },
  products: { select: { id: true, name: true, slug: true } },
} as const;

async function loadHighlightsForAdmin() {
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

export const getMarketingAdminWave1 = unstable_cache(
  async () => {
    const [settings, categories] = await Promise.all([
      getSiteMarketingSettings(),
      getCategoriesForAdmin(),
    ]);
    return { settings, categories };
  },
  ["marketing-admin-wave1"],
  { revalidate: 60, tags: [MARKETING_TAG, HOME_PAGE_TAG] }
);

export const getMarketingAdminWave2 = unstable_cache(
  async () => {
    const [slides, highlights, brandRail, categoryTiles, announcements] = await Promise.all([
      prisma.homepage_hero_slides.findMany({ orderBy: { sort_order: "asc" } }).catch(() => []),
      loadHighlightsForAdmin().catch(() => []),
      prisma.homepage_brand_rail
        .findMany({
          orderBy: { sort_order: "asc" },
          include: { brands: { select: { id: true, name: true, slug: true } } },
        })
        .catch(() => []),
      prisma.homepage_category_tiles
        .findMany({
          orderBy: { sort_order: "asc" },
          include: { categories: { select: { id: true, name: true, slug: true } } },
        })
        .catch(() => []),
      prisma.announcement_entries
        .findMany({
          orderBy: [{ placement: "asc" }, { sort_order: "asc" }],
        })
        .catch(() => []),
    ]);
    return { slides, highlights, brandRail, categoryTiles, announcements };
  },
  ["marketing-admin-wave2"],
  { revalidate: 60, tags: [HOME_PAGE_TAG, ANNOUNCEMENTS_TAG, MARKETING_TAG] }
);

export const getMarketingAdminWave3 = unstable_cache(
  async () => {
    const [products, brands] = await Promise.all([
      getAdminProductPickerList(),
      getBrandsForAdmin(),
    ]);
    return { products, brands };
  },
  ["marketing-admin-wave3"],
  { revalidate: 60, tags: [PRODUCT_CATALOG_TAG, BRANDS_TAG, MARKETING_TAG] }
);
