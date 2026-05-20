import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeDiecastScale } from "@/lib/products/diecastScales";
import { cleanText, hasSuspiciousInput, isUrlSlug } from "@/lib/validation/input";
import {
  discountBucketsFromCounts,
  getCachedGlobalDiscountBuckets,
} from "@/lib/shop/shopFacets";
import { categoryIdsForFilterSlugs, slugMatchOrClause } from "@/lib/shop/categoryTree";
import {
  loadListingFacets,
  resolveBrandIdsForSlugs,
  type FacetCacheParams,
  type FacetLoadContext,
  type ListingFacetsBundle,
} from "@/lib/shop/shopListingFacets";
import {
  createShopListingProfile,
  finishShopListingProfile,
  profiledQuery,
  type ShopListingProfile,
} from "@/lib/shop/shopListingProfile";
import { resolveSearchProductIds } from "@/lib/shop/shopListingSearch";

const PRODUCT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseProductIdList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!PRODUCT_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 400) break;
  }
  return out;
}

function toInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

type EmptyListingPayload = ListingFacetsBundle & {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: [];
};

function emptyListingData(
  page: number,
  pageSize: number,
  discountBuckets: ListingFacetsBundle["discountBuckets"] = []
): EmptyListingPayload {
  return {
    page,
    pageSize,
    total: 0,
    totalPages: 1,
    ageGroups: [],
    diecastScales: [],
    brands: [],
    productSubtypes: [],
    productCollections: [],
    discountBuckets,
    items: [],
  };
}

/** For facet counts: same filters, drop taxonomy dims, require active + in stock. */
function facetWhereFrom(base: Record<string, unknown>): Prisma.productsWhereInput {
  const w = { ...base } as Record<string, unknown>;
  delete w.type_id;
  delete w.subtype_id;
  delete w.collection_id;
  return {
    ...(w as Prisma.productsWhereInput),
    is_active: true,
    inventory: { some: { available_quantity: { gt: 0 } } },
  };
}

function effectiveRetailPriceWhere(
  minP: number | null,
  maxP: number | null,
  now: Date
): Prisma.productsWhereInput {
  const saleRange: Prisma.DecimalFilter = {};
  if (minP !== null) saleRange.gte = minP;
  if (maxP !== null) saleRange.lte = maxP;

  const flashLive: Prisma.flash_sale_productsWhereInput = {
    is_active: true,
    AND: [
      { OR: [{ active_from: null }, { active_from: { lte: now } }] },
      { OR: [{ active_until: null }, { active_until: { gte: now } }] },
    ],
  };

  return {
    OR: [
      {
        flash_sale_products: {
          is: { ...flashLive, sale_price: saleRange },
        },
      },
      {
        AND: [
          {
            NOT: {
              flash_sale_products: { is: flashLive },
            },
          },
          {
            OR: [
              {
                AND: [{ discounted_price: { not: null } }, { discounted_price: saleRange }],
              },
              {
                AND: [{ discounted_price: null }, { base_price: saleRange }],
              },
            ],
          },
        ],
      },
    ],
  };
}

export type ShopListingReadyState = {
  where: Record<string, unknown>;
  orderBy: Prisma.productsOrderByWithRelationInput;
  page: number;
  pageSize: number;
  skip: number;
  discountParams: string[];
  sortPrice: "price_asc" | "price_desc" | null;
  now: Date;
  q: string;
  /** Client fuzzy search relevance order (from `/api/products/search-index`). */
  searchIdOrder: string[] | null;
  categorySlugs: string[];
  facetCacheParams: FacetCacheParams;
  facetCtx: FacetLoadContext;
};

export type PrepareShopListingResult =
  | { kind: "error"; result: { ok: false; error: string; status: number } }
  | { kind: "complete"; data: EmptyListingPayload }
  | { kind: "ready"; state: ShopListingReadyState };

export async function prepareShopListingRequest(
  usp: URLSearchParams,
  profile: ShopListingProfile
): Promise<PrepareShopListingResult> {
  const q = cleanText(usp.get("q") ?? "", 200);
  const categorySlugs = [
    ...new Set(usp.getAll("category").map((s) => cleanText(s, 160)).filter(Boolean)),
  ];
  const brandSlugs = [...new Set(usp.getAll("brand").map((s) => cleanText(s, 160)).filter(Boolean))];
  const ageGroups = [...new Set(usp.getAll("ageGroup").map((s) => cleanText(s, 50)).filter(Boolean))];
  const diecastScaleRawList = [...new Set(usp.getAll("diecastScale").map((s) => cleanText(s, 32)).filter(Boolean))];
  const minPrice = usp.get("minPrice");
  const maxPrice = usp.get("maxPrice");

  if (q && hasSuspiciousInput(q)) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_q" });
    return { kind: "error", result: { ok: false, error: "Invalid search query", status: 400 } };
  }
  for (const cat of categorySlugs) {
    if (!isUrlSlug(cat)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_category" });
      return { kind: "error", result: { ok: false, error: "Invalid category filter", status: 400 } };
    }
  }
  for (const brand of brandSlugs) {
    if (!isUrlSlug(brand)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_brand" });
      return { kind: "error", result: { ok: false, error: "Invalid brand filter", status: 400 } };
    }
  }
  for (const ageGroup of ageGroups) {
    if (ageGroup && hasSuspiciousInput(ageGroup)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_age" });
      return { kind: "error", result: { ok: false, error: "Invalid age group filter", status: 400 } };
    }
  }

  const minP = minPrice !== null && minPrice !== "" ? Number(minPrice) : null;
  const maxP = maxPrice !== null && maxPrice !== "" ? Number(maxPrice) : null;
  if ((minP !== null && !Number.isFinite(minP)) || (maxP !== null && !Number.isFinite(maxP))) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_price" });
    return { kind: "error", result: { ok: false, error: "Invalid price filter", status: 400 } };
  }
  if ((minP !== null && minP < 0) || (maxP !== null && maxP < 0)) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_price" });
    return { kind: "error", result: { ok: false, error: "Invalid price filter", status: 400 } };
  }
  const availableOnly = (usp.get("available") ?? "").trim() === "true";

  const subtypeSlugs = [...new Set(usp.getAll("subtype").map((s) => cleanText(s, 160)).filter(Boolean))];
  const collectionSlugs = [...new Set(usp.getAll("collection").map((s) => cleanText(s, 160)).filter(Boolean))];
  const discountParams = [...new Set(usp.getAll("discount").map((s) => cleanText(s, 32)).filter(Boolean))];
  for (const subtypeSlug of subtypeSlugs) {
    if (!isUrlSlug(subtypeSlug)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_subtype" });
      return { kind: "error", result: { ok: false, error: "Invalid sub category filter", status: 400 } };
    }
  }
  for (const collectionSlug of collectionSlugs) {
    if (!isUrlSlug(collectionSlug)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_collection" });
      return { kind: "error", result: { ok: false, error: "Invalid collection filter", status: 400 } };
    }
  }
  for (const discountParam of discountParams) {
    if (!/^(b10|b25|b50|b100|on_sale)$/.test(discountParam)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_discount" });
      return { kind: "error", result: { ok: false, error: "Invalid discount filter", status: 400 } };
    }
  }

  const sortRaw = cleanText(usp.get("sort") ?? "", 32);
  const sortPrice =
    sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : null;
  if (sortRaw && !sortPrice) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_sort" });
    return { kind: "error", result: { ok: false, error: "Invalid sort", status: 400 } };
  }

  const page = Math.max(1, toInt(usp.get("page"), 1));
  const pageSize = Math.min(24, Math.max(6, toInt(usp.get("pageSize"), 12)));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { is_active: true };

  const idsRaw = cleanText(usp.get("ids") ?? "", 12000);
  let searchIdOrder: string[] | null = null;
  if (idsRaw) {
    const parsedIds = parseProductIdList(idsRaw);
    if (parsedIds.length === 0) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_ids" });
      return { kind: "error", result: { ok: false, error: "Invalid product id list", status: 400 } };
    }
    searchIdOrder = parsedIds;
    where.id = { in: parsedIds };
  }

  if (q && !searchIdOrder) {
    const searchIds = await resolveSearchProductIds(q, profile);
    if (searchIds.length === 0) {
      const globalBuckets = await profiledQuery(profile, "facets.globalDiscountEmptySearch", () =>
        getCachedGlobalDiscountBuckets()
      );
      const data = emptyListingData(page, pageSize, discountBucketsFromCounts(globalBuckets));
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "search" });
      return { kind: "complete", data };
    }
    where.id = { in: searchIds };
  }
  if (ageGroups.length) where.age_group = { in: ageGroups };
  const diecastNorms: string[] = [];
  for (const raw of diecastScaleRawList) {
    const n = normalizeDiecastScale(raw);
    if (!n) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_diecast" });
      return { kind: "error", result: { ok: false, error: "Invalid diecast scale filter", status: 400 } };
    }
    diecastNorms.push(n);
  }
  if (diecastNorms.length) where.diecast_scales = { is: { ratio: { in: diecastNorms } } };
  const now = new Date();
  if (minP !== null || maxP !== null) {
    const priceClause = effectiveRetailPriceWhere(minP, maxP, now);
    where.AND = [...((where.AND as unknown[]) ?? []), priceClause];
  }

  let selectedCategoryIdSet: Set<string> | null = null;
  if (categorySlugs.length > 0) {
    const idSet = await profiledQuery(profile, "categories.resolveSlugs", () =>
      categoryIdsForFilterSlugs(categorySlugs)
    );
    if (idSet.size === 0) {
      const data = emptyListingData(page, pageSize);
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "category" });
      return { kind: "complete", data };
    }
    where.category_id = { in: [...idSet] };
    selectedCategoryIdSet = idSet;
  }

  const taxonomyResolves = await Promise.all([
    subtypeSlugs.length
      ? profiledQuery(profile, "taxonomy.subtypes", () => {
          const subtypeWhere: Prisma.product_subtypesWhereInput = {
            is_active: true,
            OR: subtypeSlugs.flatMap((s) => slugMatchOrClause(s)),
          };
          if (selectedCategoryIdSet) {
            subtypeWhere.category_id = { in: [...selectedCategoryIdSet] };
          }
          return prisma.product_subtypes.findMany({
            where: subtypeWhere,
            select: { id: true },
          });
        })
      : Promise.resolve(null),
    collectionSlugs.length
      ? profiledQuery(profile, "taxonomy.collections", () =>
          prisma.product_collections.findMany({
            where: { is_active: true, OR: collectionSlugs.flatMap((s) => slugMatchOrClause(s)) },
            select: { id: true },
          })
        )
      : Promise.resolve(null),
    brandSlugs.length
      ? resolveBrandIdsForSlugs(brandSlugs, profile)
      : Promise.resolve(null),
  ]);

  const [sRows, cRows, brandIds] = taxonomyResolves;
  if (sRows !== null) {
    if (sRows.length === 0) {
      const data = emptyListingData(page, pageSize);
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "subtype" });
      return { kind: "complete", data };
    }
    (where as { subtype_id?: { in: string[] } }).subtype_id = { in: sRows.map((s) => s.id) };
  }
  if (cRows !== null) {
    if (cRows.length === 0) {
      const data = emptyListingData(page, pageSize);
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "collection" });
      return { kind: "complete", data };
    }
    (where as { collection_id?: { in: string[] } }).collection_id = { in: cRows.map((c) => c.id) };
  }
  if (brandIds !== null) {
    if (brandIds.length === 0) {
      const data = emptyListingData(page, pageSize);
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "brand" });
      return { kind: "complete", data };
    }
    where.brand_id = { in: brandIds };
  }

  if (availableOnly) {
    where.inventory = { some: { available_quantity: { gt: 0 } } };
  }

  const fw = facetWhereFrom(where);
  const wNoAge: Prisma.productsWhereInput = { ...fw };
  delete (wNoAge as { age_group?: unknown }).age_group;
  const wNoBrand: Prisma.productsWhereInput = { ...fw };
  delete (wNoBrand as { brand_id?: unknown }).brand_id;
  const brandFacetWhere: Prisma.productsWhereInput =
    categorySlugs.length > 0
      ? {
          is_active: true,
          inventory: { some: { available_quantity: { gt: 0 } } },
          ...(((where as { category_id?: unknown }).category_id && {
            category_id: (where as { category_id?: unknown }).category_id,
          }) ||
            {}),
        }
      : wNoBrand;
  const wNoSubtype: Prisma.productsWhereInput = { ...fw };
  delete (wNoSubtype as { subtype_id?: unknown }).subtype_id;

  const orderBy: Prisma.productsOrderByWithRelationInput =
    sortPrice === "price_asc"
      ? { base_price: "asc" }
      : sortPrice === "price_desc"
        ? { base_price: "desc" }
        : { updated_at: "desc" };

  const hasHeavyFilters =
    Boolean(q) ||
    Boolean(searchIdOrder?.length) ||
    categorySlugs.length > 0 ||
    brandSlugs.length > 0 ||
    ageGroups.length > 0 ||
    diecastNorms.length > 0 ||
    subtypeSlugs.length > 0 ||
    collectionSlugs.length > 0 ||
    minP !== null ||
    maxP !== null ||
    availableOnly;

  const facetCacheParams: FacetCacheParams = {
    q,
    categorySlugs,
    brandSlugs,
    ageGroups,
    diecastNorms,
    subtypeSlugs,
    collectionSlugs,
    minP,
    maxP,
    availableOnly,
  };

  const facetCtx: FacetLoadContext = {
    profile,
    fw,
    wNoAge,
    wNoBrand,
    wNoSubtype,
    brandFacetWhere,
    selectedCategoryIdSet,
    diecastNorms,
    hasHeavyFilters,
    brandSlugsForUi: brandSlugs,
  };

  return {
    kind: "ready",
    state: {
      where,
      orderBy,
      page,
      pageSize,
      skip,
      discountParams,
      sortPrice,
      now,
      q,
      searchIdOrder,
      categorySlugs,
      facetCacheParams,
      facetCtx,
    },
  };
}

export type ShopListingFacetsResult =
  | { ok: true; facets: ListingFacetsBundle }
  | { ok: false; error: string; status: number };

/** Facet aggregation only (per-filter cache inside `loadListingFacets`). */
export async function getShopListingFacetsOnly(usp: URLSearchParams): Promise<ShopListingFacetsResult> {
  const profile = createShopListingProfile();
  const prep = await prepareShopListingRequest(usp, profile);

  if (prep.kind === "error") {
    return prep.result;
  }
  if (prep.kind === "complete") {
    return { ok: true, facets: prep.data };
  }

  const facets = await loadListingFacets(prep.state.facetCacheParams, prep.state.facetCtx);
  return { ok: true, facets };
}
