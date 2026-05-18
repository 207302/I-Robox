import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
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
      return await prisma.categories.findMany({
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
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
function dedupeNavItems(items: HeaderNavItem[]): HeaderNavItem[] {
  const seen = new Set<string>();
  const out: HeaderNavItem[] = [];
  for (const item of items) {
    const key = item.slug.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function getHeaderNavData(): Promise<HeaderNavData> {
  const [categories, brands] = await Promise.all([
    getCachedNavCategories(),
    getCachedNavBrands(),
  ]);

  return {
    categories: dedupeNavItems(categories),
    brands: dedupeNavItems(brands),
  };
}
