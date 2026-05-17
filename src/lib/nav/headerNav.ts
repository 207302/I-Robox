import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeCategoriesFindMany } from "@/lib/db/safeReads";
import { BRANDS_TAG, CATEGORIES_TAG, HEADER_NAV_TAG } from "@/lib/cache/tags";

/** Slug + display name for header dropdowns (categories, brands). */
export type HeaderNavItem = { slug: string; name: string };

export type HeaderNavData = {
  categories: HeaderNavItem[];
  brands: HeaderNavItem[];
};

const BUILD_QUERY_CACHE_SECONDS = 3600;

/** Shared across all SSG workers during `next build` — one DB round-trip per deploy. */
const getCachedNavCategories = unstable_cache(
  async (): Promise<HeaderNavItem[]> => {
    try {
      return await safeCategoriesFindMany({
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      });
    } catch {
      return [];
    }
  },
  ["nav-categories-all"],
  { revalidate: BUILD_QUERY_CACHE_SECONDS, tags: [CATEGORIES_TAG, HEADER_NAV_TAG] }
);

const getCachedNavBrands = unstable_cache(
  async (): Promise<HeaderNavItem[]> => {
    try {
      return await prisma.brands.findMany({
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      });
    } catch {
      return [];
    }
  },
  ["nav-brands-all"],
  { revalidate: BUILD_QUERY_CACHE_SECONDS, tags: [BRANDS_TAG, HEADER_NAV_TAG] }
);

/**
 * Primary nav: all categories and all brands (alphabetical).
 * Shop links use `/shop?category=…` and `/shop?brand=…`.
 */
export async function getHeaderNavData(): Promise<HeaderNavData> {
  const [categories, brands] = await Promise.all([
    getCachedNavCategories(),
    getCachedNavBrands(),
  ]);

  return { categories, brands };
}
