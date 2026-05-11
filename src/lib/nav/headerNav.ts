import { prisma } from "@/lib/prismaDB";

/** Slug + display name for header dropdowns (categories, brands). */
export type HeaderNavItem = { slug: string; name: string };

export type HeaderNavData = {
  categories: HeaderNavItem[];
  brands: HeaderNavItem[];
};

/**
 * Primary nav: all categories and all brands (alphabetical).
 * Shop links use `/shop?category=…` and `/shop?brand=…`.
 */
export async function getHeaderNavData(): Promise<HeaderNavData> {
  const [categories, brands] = await Promise.all([
    prisma.categories.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.brands.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { categories, brands };
}
