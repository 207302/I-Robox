import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BRANDS_TAG, CATEGORIES_TAG, PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG } from "@/lib/cache/tags";
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

/** Full catalog options for sidebar filters (counts merged per current listing context). */
const getCachedCatalogBrands = unstable_cache(
  async () =>
    prisma.brands.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["shop-catalog-brands"],
  { revalidate: SHOP_LISTING_FACETS_REVALIDATE_SECONDS, tags: [BRANDS_TAG, PRODUCT_CATALOG_TAG] }
);

const getCachedCatalogSubtypes = unstable_cache(
  async () =>
    prisma.product_subtypes.findMany({
      where: { is_active: true },
      select: { id: true, slug: true, name: true, category_id: true },
      orderBy: { name: "asc" },
    }),
  ["shop-catalog-subtypes"],
  { revalidate: SHOP_LISTING_FACETS_REVALIDATE_SECONDS, tags: [CATEGORIES_TAG, PRODUCT_CATALOG_TAG] }
);

const getCachedCatalogCollections = unstable_cache(
  async () =>
    prisma.product_collections.findMany({
      where: { is_active: true },
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["shop-catalog-collections"],
  { revalidate: SHOP_LISTING_FACETS_REVALIDATE_SECONDS, tags: [PRODUCT_CATALOG_TAG] }
);

const getCachedCatalogAgeGroups = unstable_cache(
  async () => {
    const rows = await prisma.products.findMany({
      where: { is_active: true, age_group: { not: null } },
      distinct: ["age_group"],
      select: { age_group: true },
      orderBy: { age_group: "asc" },
    });
    return rows
      .map((r) => r.age_group)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  },
  ["shop-catalog-age-groups"],
  { revalidate: SHOP_LISTING_FACETS_REVALIDATE_SECONDS, tags: [PRODUCT_CATALOG_TAG] }
);

/** Total active products per taxonomy id (not limited to in-stock). */
const getCachedCatalogFacetCounts = unstable_cache(
  async () => {
    const activeWhere = { is_active: true } as const;
    const [brandGroups, subtypeGroups, collectionGroups] = await Promise.all([
      prisma.products.groupBy({
        by: ["brand_id"],
        where: { ...activeWhere, brand_id: { not: null } },
        _count: { _all: true },
      }),
      prisma.products.groupBy({
        by: ["subtype_id"],
        where: { ...activeWhere, subtype_id: { not: null } },
        _count: { _all: true },
      }),
      prisma.products.groupBy({
        by: ["collection_id"],
        where: { ...activeWhere, collection_id: { not: null } },
        _count: { _all: true },
      }),
    ]);
    return { brandGroups, subtypeGroups, collectionGroups };
  },
  ["shop-catalog-facet-counts"],
  { revalidate: SHOP_LISTING_FACETS_REVALIDATE_SECONDS, tags: [PRODUCT_CATALOG_TAG] }
);

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
    wNoSubtype,
    selectedCategoryIdSet,
    diecastNorms,
    hasHeavyFilters,
    brandSlugsForUi,
  } = ctx;

  const [
    catalogBrands,
    catalogSubtypes,
    catalogCollections,
    catalogAgeGroups,
    catalogCounts,
    ageGroupsRaw,
    diecastScalesCached,
    discountBucketCounts,
  ] = await Promise.all([
    getCachedCatalogBrands(),
    getCachedCatalogSubtypes(),
    getCachedCatalogCollections(),
    getCachedCatalogAgeGroups(),
    getCachedCatalogFacetCounts(),
    profiledQuery(profile, "facets.ageGroups", () =>
      prisma.products.findMany({
        where: { ...wNoAge, age_group: { not: null } },
        distinct: ["age_group"],
        select: { age_group: true },
        orderBy: { age_group: "asc" },
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

  const brandTotalCount = new Map(
    catalogCounts.brandGroups.map((g) => [g.brand_id, g._count._all] as const)
  );
  const subtypeTotalCount = new Map(
    catalogCounts.subtypeGroups.map((g) => [g.subtype_id, g._count._all] as const)
  );
  const collectionTotalCount = new Map(
    catalogCounts.collectionGroups.map((g) => [g.collection_id, g._count._all] as const)
  );

  const subtypeCatalog =
    selectedCategoryIdSet && selectedCategoryIdSet.size > 0
      ? catalogSubtypes.filter((s) => selectedCategoryIdSet.has(s.category_id))
      : catalogSubtypes;

  const productSubtypes: ListingFacetRow[] = subtypeCatalog.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: subtypeTotalCount.get(r.id) ?? 0,
  }));

  const productCollections: ListingFacetRow[] = catalogCollections.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: collectionTotalCount.get(r.id) ?? 0,
  }));

  let brands: ListingFacetBrand[] = catalogBrands.map((b) => ({
    slug: b.slug,
    name: b.name,
    count: brandTotalCount.get(b.id) ?? 0,
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

  const facetAgeGroups = ageGroupsRaw
    .map((x) => x.age_group)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const ageGroups = [...new Set([...catalogAgeGroups, ...facetAgeGroups])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return {
    ageGroups,
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
async function fetchBrandsForSlugKey(slugKey: string) {
  const brandSlugs = slugKey.split("|").filter(Boolean);
  if (brandSlugs.length === 0) return [];
  return prisma.brands.findMany({
    where: { OR: brandSlugs.flatMap((s) => slugMatchOrClause(s)) },
    select: { id: true, slug: true },
  });
}

export async function resolveBrandIdsForSlugs(
  brandSlugs: string[],
  profile: ShopListingProfile
): Promise<string[]> {
  if (brandSlugs.length === 0) return [];
  const slugKey = [...new Set(brandSlugs.map((s) => s.trim()).filter(Boolean))].sort().join("|");
  const rows = await profiledQuery(profile, "brands.resolveSlugs", () =>
    unstable_cache(
      onCacheMiss(`brand-slugs-resolve:${slugKey}`, () => fetchBrandsForSlugKey(slugKey)),
      ["brand-slugs-resolve", slugKey],
      { revalidate: 300, tags: [BRANDS_TAG, PRODUCT_CATALOG_TAG] }
    )()
  );
  const ids: string[] = [];
  for (const slug of brandSlugs) {
    const variants = new Set(slugVariants(slug).map((v) => v.toLowerCase()));
    const hit = rows.find((r) => variants.has(r.slug.toLowerCase()));
    if (hit) ids.push(hit.id);
  }
  return [...new Set(ids)];
}
