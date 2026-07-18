import { prisma } from "@/lib/prisma";

export type BrandCollectionCard = {
  slug: string;
  name: string;
  productCount: number;
  image: string | null;
};

export type BrandPagePayload = {
  brand: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  /** Admin description when set, otherwise a generated per-brand blurb.
   *  Always non-empty so brand pages never render as content-less (soft 404). */
  blurb: string;
  heroImage: string | null;
  logoImage: string | null;
  stats: {
    productCount: number;
    collectionCount: number;
    rating: number | null;
  };
  collections: BrandCollectionCard[];
};

function buildBrandBlurb(
  name: string,
  productCount: number,
  collections: BrandCollectionCard[]
): string {
  const sentences: string[] = [
    `Explore the ${name} collection at i-robox — RC toys, diecast models, and collectibles from a brand collectors trust.`,
  ];
  if (collections.length > 0) {
    const top = collections.slice(0, 3).map((c) => c.name);
    const list =
      top.length === 1
        ? top[0]
        : `${top.slice(0, -1).join(", ")} and ${top[top.length - 1]}`;
    sentences.push(`Popular ${name} ranges include ${list}.`);
  }
  if (productCount > 0) {
    sentences.push(
      `Browse ${productCount}+ ${name} products with secure checkout and fast delivery across India.`
    );
  } else {
    sentences.push(
      `${name} stock is currently being replenished — new arrivals land here first, so check back soon or explore similar brands in the shop.`
    );
  }
  return sentences.join(" ");
}

export async function getBrandPagePayload(slug: string): Promise<BrandPagePayload | null> {
  const brand = await prisma.brands.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      brand_pages: { select: { hero_image: true } },
      homepage_brand_rail: {
        select: { image_url: true },
        orderBy: { sort_order: "asc" },
        take: 1,
      },
    },
  });
  if (!brand) return null;

  const [productCount, categoryGroups, ratingAgg] = await Promise.all([
    prisma.products.count({
      where: { brand_id: brand.id, is_active: true },
    }),
    prisma.products.groupBy({
      by: ["category_id"],
      where: {
        brand_id: brand.id,
        is_active: true,
        category_id: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.reviews.aggregate({
      _avg: { rating: true },
      where: {
        is_approved: true,
        products: { brand_id: brand.id, is_active: true },
      },
    }),
  ]);

  const categoryIds = categoryGroups
    .map((g) => g.category_id)
    .filter((id): id is string => Boolean(id));

  const categories =
    categoryIds.length > 0
      ? await prisma.categories.findMany({
          where: { id: { in: categoryIds } },
          select: {
            id: true,
            slug: true,
            name: true,
            homepage_category_tiles: {
              select: { image_url: true },
            },
          },
        })
      : [];

  const countByCategoryId = new Map(
    categoryGroups.map((g) => [g.category_id!, g._count._all] as const)
  );

  const collections: BrandCollectionCard[] = categories
    .map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      productCount: countByCategoryId.get(cat.id) ?? 0,
      image: cat.homepage_category_tiles?.image_url ?? null,
    }))
    .filter((c) => c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount);

  const avgRating = ratingAgg._avg.rating;
  const rating = avgRating != null ? Math.round(avgRating * 10) / 10 : null;

  return {
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
    },
    blurb:
      brand.description?.trim() ||
      buildBrandBlurb(brand.name, productCount, collections),
    heroImage: brand.brand_pages?.hero_image ?? null,
    logoImage: brand.homepage_brand_rail[0]?.image_url ?? null,
    stats: {
      productCount,
      collectionCount: collections.length,
      rating,
    },
    collections,
  };
}

export async function getAllBrandSlugs(): Promise<string[]> {
  const rows = await prisma.brands.findMany({
    select: { slug: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.slug);
}
