import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG } from "@/lib/cache/tags";
import {
  computeDiscountBucketsForProductIds,
  discountBucketsFromCounts,
  getCachedDiecastScales,
  getCachedGlobalDiscountBuckets,
} from "@/lib/shop/shopFacets";
import { slugMatchOrClause, slugVariants } from "@/lib/shop/categoryTree";
import { profiledQuery, type ShopListingProfile } from "@/lib/shop/shopListingProfile";
import { onCacheMiss } from "@/lib/observability/cache";

/** Per-filter facet bundle cache TTL (GET /api/products facet layer). */
export const SHOP_LISTING_FACETS_REVALIDATE_SECONDS = 600;

export type ListingFacetBrand = { slug: string; name: string; count: number };
export type ListingFacetRow = { slug: string; name: string; count: number };

export type ListingFacetsBundle = {
  ageGroups: string[];
  diecastScales: string[];
  brands: ListingFacetBrand[];
  productSubtypes: ListingFacetRow[];
  productCollections: ListingFacetRow[];
  discountBuckets: { id: string; label: string; count: number }[];
};

export type FacetCacheParams = {
  q: string;
  categorySlugs: string[];
  brandSlugs: string[];
  ageGroups: string[];
  diecastNorms: string[];
  subtypeSlugs: string[];
  collectionSlugs: string[];
  minP: number | null;
  maxP: number | null;
  availableOnly: boolean;
};

export function buildFacetCacheKey(p: FacetCacheParams): string | null {
  if (p.q.trim()) return null;
  return JSON.stringify({
    c: [...p.categorySlugs].sort(),
    b: [...p.brandSlugs].sort(),
    a: [...p.ageGroups].sort(),
    d: [...p.diecastNorms].sort(),
    st: [...p.subtypeSlugs].sort(),
    col: [...p.collectionSlugs].sort(),
    min: p.minP,
    max: p.maxP,
    av: p.availableOnly,
  });
}

export type FacetLoadContext = {
  profile: ShopListingProfile;
  fw: Prisma.productsWhereInput;
  wNoAge: Prisma.productsWhereInput;
  wNoBrand: Prisma.productsWhereInput;
  wNoSubtype: Prisma.productsWhereInput;
  brandFacetWhere: Prisma.productsWhereInput;
  selectedCategoryIdSet: Set<string> | null;
  diecastNorms: string[];
  hasHeavyFilters: boolean;
  brandSlugsForUi: string[];
};

async function loadListingFacetsInternal(ctx: FacetLoadContext): Promise<ListingFacetsBundle> {
  const {
    profile,
    fw,
    wNoAge,
    wNoBrand,
    wNoSubtype,
    brandFacetWhere,
    selectedCategoryIdSet,
    diecastNorms,
    hasHeavyFilters,
    brandSlugsForUi,
  } = ctx;

  const [ageGroupsRaw, subGroups, colGroups, brandIdGroups, diecastScalesCached, discountBucketCounts] =
    await Promise.all([
      profiledQuery(profile, "facets.ageGroups", () =>
        prisma.products.findMany({
          where: { ...wNoAge, age_group: { not: null } },
          distinct: ["age_group"],
          select: { age_group: true },
          orderBy: { age_group: "asc" },
        })
      ),
      profiledQuery(profile, "facets.subtypeGroupBy", () =>
        prisma.products.groupBy({
          by: ["subtype_id"],
          where: { ...wNoSubtype, subtype_id: { not: null } } as never,
          _count: { _all: true },
        })
      ),
      profiledQuery(profile, "facets.collectionGroupBy", () =>
        prisma.products.groupBy({
          by: ["collection_id"],
          where: { ...wNoSubtype, collection_id: { not: null } } as never,
          _count: { _all: true },
        })
      ),
      profiledQuery(profile, "facets.brandGroupBy", () =>
        prisma.products.groupBy({
          by: ["brand_id"],
          where: { ...brandFacetWhere, brand_id: { not: null } } as never,
          _count: { _all: true },
        })
      ),
      getCachedDiecastScales(),
      hasHeavyFilters
        ? profiledQuery(profile, "facets.discountIds+aggregate", async () => {
            const rows = await prisma.products.findMany({ where: fw, select: { id: true } });
            return computeDiscountBucketsForProductIds(rows.map((r) => r.id));
          })
        : getCachedGlobalDiscountBuckets(),
    ]);

  const subIdList = subGroups.map((g) => g.subtype_id).filter((v): v is string => v !== null);
  const colIdList = colGroups.map((g) => g.collection_id).filter((v): v is string => v !== null);

  const [subRows, colRows, brandsIfAny] = await Promise.all([
    subIdList.length
      ? profiledQuery(profile, "facets.subtypeRows", () => {
          const subRowsWhere: Prisma.product_subtypesWhereInput = {
            id: { in: subIdList },
            is_active: true,
          };
          if (selectedCategoryIdSet) {
            subRowsWhere.category_id = { in: [...selectedCategoryIdSet] };
          }
          return prisma.product_subtypes.findMany({
            where: subRowsWhere,
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" },
          });
        })
      : Promise.resolve([]),
    colIdList.length
      ? profiledQuery(profile, "facets.collectionRows", () =>
          prisma.product_collections.findMany({
            where: { id: { in: colIdList } },
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" },
          })
        )
      : Promise.resolve([]),
    (async () => {
      const brandIdsFromGroups = brandIdGroups
        .map((g) => g.brand_id)
        .filter((v): v is string => v !== null);
      if (brandIdsFromGroups.length === 0) return [];
      return profiledQuery(profile, "facets.brandRows", () =>
        prisma.brands.findMany({
          where: { id: { in: brandIdsFromGroups } },
          select: { id: true, slug: true, name: true },
          orderBy: { name: "asc" },
        })
      );
    })(),
  ]);

  const sCount = new Map(subGroups.map((g) => [g.subtype_id, g._count._all] as const));
  const productSubtypes: ListingFacetRow[] = subRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: sCount.get(r.id) ?? 0,
  }));

  const cCount = new Map(colGroups.map((g) => [g.collection_id, g._count._all] as const));
  const productCollections: ListingFacetRow[] = colRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: cCount.get(r.id) ?? 0,
  }));

  const bCount = new Map(brandIdGroups.map((g) => [g.brand_id, g._count._all] as const));
  let brands: ListingFacetBrand[] = brandsIfAny.map((b) => ({
    slug: b.slug,
    name: b.name,
    count: bCount.get(b.id) ?? 0,
  }));

  if (brandSlugsForUi.length > 0) {
    const missing = brandSlugsForUi.filter(
      (slug) => !brands.some((b) => b.slug.toLowerCase() === slug.toLowerCase())
    );
    if (missing.length > 0) {
      const extraRows = await profiledQuery(profile, "facets.brandUiZero", () =>
        prisma.brands.findMany({
          where: { OR: missing.flatMap((s) => slugMatchOrClause(s)) },
          select: { slug: true, name: true },
        })
      );
      for (const slug of missing) {
        const variants = new Set(slugVariants(slug).map((v) => v.toLowerCase()));
        const row = extraRows.find((r) => variants.has(r.slug.toLowerCase()));
        if (row) brands.push({ ...row, count: 0 });
      }
      brands = brands.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  const mergedDiecast = [...new Set([...diecastNorms, ...diecastScalesCached])].sort((a, b) => {
    const na = parseInt(a.replace(/^1:/i, ""), 10);
    const nb = parseInt(b.replace(/^1:/i, ""), 10);
    return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
  });

  return {
    ageGroups: ageGroupsRaw
      .map((x) => x.age_group)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
    diecastScales: mergedDiecast,
    brands,
    productSubtypes,
    productCollections,
    discountBuckets: discountBucketsFromCounts(discountBucketCounts),
  };
}

export async function loadListingFacets(
  cacheParams: FacetCacheParams,
  ctx: FacetLoadContext
): Promise<ListingFacetsBundle> {
  const key = buildFacetCacheKey(cacheParams);
  if (!key) {
    return loadListingFacetsInternal(ctx);
  }

  return unstable_cache(
    onCacheMiss(`shop-listing-facets:${key}`, () => loadListingFacetsInternal(ctx)),
    ["shop-listing-facets", key],
    {
      revalidate: SHOP_LISTING_FACETS_REVALIDATE_SECONDS,
      tags: [PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG],
    }
  )();
}

/** Batch-resolve brand slugs → ids (one query instead of N findFirst). */
export async function resolveBrandIdsForSlugs(
  brandSlugs: string[],
  profile: ShopListingProfile
): Promise<string[]> {
  if (brandSlugs.length === 0) return [];
  const rows = await profiledQuery(profile, "brands.resolveSlugs", () =>
    prisma.brands.findMany({
      where: { OR: brandSlugs.flatMap((s) => slugMatchOrClause(s)) },
      select: { id: true, slug: true },
    })
  );
  const ids: string[] = [];
  for (const slug of brandSlugs) {
    const variants = new Set(slugVariants(slug).map((v) => v.toLowerCase()));
    const hit = rows.find((r) => variants.has(r.slug.toLowerCase()));
    if (hit) ids.push(hit.id);
  }
  return [...new Set(ids)];
}
