import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeDiecastScale } from "@/lib/products/diecastScales";
import { cleanText, hasSuspiciousInput, isUrlSlug } from "@/lib/validation/input";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  discountBucketsFromCounts,
  getCachedGlobalDiscountBuckets,
  paginateDiscountFilteredProductIds,
} from "@/lib/shop/shopFacets";
import { categoryIdsForFilterSlugs, slugMatchOrClause } from "@/lib/shop/categoryTree";
import {
  loadListingFacets,
  resolveBrandIdsForSlugs,
  type FacetCacheParams,
} from "@/lib/shop/shopListingFacets";
import {
  createShopListingProfile,
  finishShopListingProfile,
  profiledQuery,
} from "@/lib/shop/shopListingProfile";
import { resolveSearchProductIds } from "@/lib/shop/shopListingSearch";
import type { ShopListingRequestOptions } from "@/lib/shop/shopListingParams";

export type ShopListingItem = {
  id: string;
  title: string;
  image: string;
  shortDescription: string;
  description: string;
  ageGroup: string | null;
  diecastScale: string | null;
  price: number;
  discountedPrice: number | null;
  shippingPerUnit: number;
  slug: string;
  quantity: number;
  updatedAt: Date;
  reviews: number;
  product_images: { url: string; sort_order: number }[];
  productVariants: { name?: string; color: string; size: string; isDefault: boolean; image: string }[];
};

export type ShopListingData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  ageGroups: string[];
  diecastScales: string[];
  brands: { slug: string; name: string; count: number }[];
  productSubtypes: { slug: string; name: string; count: number }[];
  productCollections: { slug: string; name: string; count: number }[];
  discountBuckets: { id: string; label: string; count: number }[];
  items: ShopListingItem[];
};

function toInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function emptyListingData(
  page: number,
  pageSize: number,
  discountBuckets: ShopListingData["discountBuckets"] = []
): ShopListingData {
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

/**
 * Price filter matches what the customer sees: active flash sale price, else discounted/base.
 */
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

function mapProductsToItems(
  products: {
    id: string;
    name: string;
    short_description: string | null;
    base_price: { toString(): string } | number;
    discounted_price: { toString(): string } | number | null;
    age_group: string | null;
    diecast_scales: { ratio: string } | null;
    slug: string;
    updated_at: Date;
    sku: string | null;
    shipping_per_unit: { toString(): string } | number | null;
    product_images: { url: string; sort_order: number }[];
    product_variants: {
      name: string | null;
      color: string | null;
      size: string | null;
      is_default: boolean;
      product_images: { url: string }[];
    }[];
    inventory: { available_quantity: number }[];
  }[],
  flashMap: Map<string, number>
): ShopListingItem[] {
  return products.map((p) => {
    const images = p.product_images.slice().sort((a, b) => a.sort_order - b.sort_order);
    const image = images[0]?.url ?? "";
    const quantity = p.inventory.reduce((sum, r) => sum + r.available_quantity, 0);
    const flashPrice = flashMap.get(p.id);
    const basePrice = Number(p.base_price);
    const regularDiscounted = p.discounted_price ? Number(p.discounted_price) : null;
    const effectiveDiscounted = flashPrice ?? regularDiscounted;
    return {
      id: p.id,
      title: p.name,
      image,
      shortDescription: p.short_description ?? "",
      description: "",
      ageGroup: p.age_group ?? null,
      diecastScale: p.diecast_scales?.ratio ?? null,
      price: basePrice,
      discountedPrice: effectiveDiscounted,
      shippingPerUnit: Number(p.shipping_per_unit ?? 0),
      slug: p.slug,
      quantity,
      updatedAt: p.updated_at,
      reviews: 0,
      product_images: images,
      productVariants: p.product_variants.map((v) => ({
        name: v.name ?? "",
        color: v.color ?? "",
        size: v.size ?? "",
        isDefault: v.is_default,
        image: v.product_images[0]?.url ?? image,
      })),
    };
  });
}

export type ShopListingResult =
  | { ok: true; data: ShopListingData }
  | { ok: false; error: string; status: number };

/**
 * Shared shop listing (used by GET /api/products and the Shop server page).
 * Avoids internal HTTP fetches so localhost always uses the same DB as Prisma.
 */
const emptyFacetsBundle = {
  ageGroups: [] as string[],
  diecastScales: [] as string[],
  brands: [] as { slug: string; name: string; count: number }[],
  productSubtypes: [] as { slug: string; name: string; count: number }[],
  productCollections: [] as { slug: string; name: string; count: number }[],
  discountBuckets: [] as { id: string; label: string; count: number }[],
};

export async function getShopListing(
  usp: URLSearchParams,
  requestOptions?: Partial<ShopListingRequestOptions>
): Promise<ShopListingResult> {
  const includeFacets = requestOptions?.includeFacets !== false;
  const profile = createShopListingProfile();
  const startedAt = profile.startedAt;

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
    return { ok: false, error: "Invalid search query", status: 400 };
  }
  for (const cat of categorySlugs) {
    if (!isUrlSlug(cat)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_category" });
      return { ok: false, error: "Invalid category filter", status: 400 };
    }
  }
  for (const brand of brandSlugs) {
    if (!isUrlSlug(brand)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_brand" });
      return { ok: false, error: "Invalid brand filter", status: 400 };
    }
  }
  for (const ageGroup of ageGroups) {
    if (ageGroup && hasSuspiciousInput(ageGroup)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_age" });
      return { ok: false, error: "Invalid age group filter", status: 400 };
    }
  }

  const minP = minPrice !== null && minPrice !== "" ? Number(minPrice) : null;
  const maxP = maxPrice !== null && maxPrice !== "" ? Number(maxPrice) : null;
  if ((minP !== null && !Number.isFinite(minP)) || (maxP !== null && !Number.isFinite(maxP))) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_price" });
    return { ok: false, error: "Invalid price filter", status: 400 };
  }
  if ((minP !== null && minP < 0) || (maxP !== null && maxP < 0)) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_price" });
    return { ok: false, error: "Invalid price filter", status: 400 };
  }
  const availableOnly = (usp.get("available") ?? "").trim() === "true";

  const subtypeSlugs = [...new Set(usp.getAll("subtype").map((s) => cleanText(s, 160)).filter(Boolean))];
  const collectionSlugs = [...new Set(usp.getAll("collection").map((s) => cleanText(s, 160)).filter(Boolean))];
  const discountParams = [...new Set(usp.getAll("discount").map((s) => cleanText(s, 32)).filter(Boolean))];
  for (const subtypeSlug of subtypeSlugs) {
    if (!isUrlSlug(subtypeSlug)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_subtype" });
      return { ok: false, error: "Invalid sub category filter", status: 400 };
    }
  }
  for (const collectionSlug of collectionSlugs) {
    if (!isUrlSlug(collectionSlug)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_collection" });
      return { ok: false, error: "Invalid collection filter", status: 400 };
    }
  }
  for (const discountParam of discountParams) {
    if (!/^(b10|b25|b50|b100|on_sale)$/.test(discountParam)) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_discount" });
      return { ok: false, error: "Invalid discount filter", status: 400 };
    }
  }

  const sortRaw = cleanText(usp.get("sort") ?? "", 32);
  const sortPrice =
    sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : null;
  if (sortRaw && !sortPrice) {
    finishShopListingProfile(profile, { ok: false, reason: "invalid_sort" });
    return { ok: false, error: "Invalid sort", status: 400 };
  }

  const page = Math.max(1, toInt(usp.get("page"), 1));
  const pageSize = Math.min(24, Math.max(6, toInt(usp.get("pageSize"), 12)));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { is_active: true };
  if (q) {
    const searchIds = await resolveSearchProductIds(q, profile);
    if (searchIds.length === 0) {
      const globalBuckets = await profiledQuery(profile, "facets.globalDiscountEmptySearch", () =>
        getCachedGlobalDiscountBuckets()
      );
      const data = emptyListingData(page, pageSize, discountBucketsFromCounts(globalBuckets));
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "search" });
      return { ok: true, data };
    }
    where.id = { in: searchIds };
  }
  if (ageGroups.length) where.age_group = { in: ageGroups };
  const diecastNorms: string[] = [];
  for (const raw of diecastScaleRawList) {
    const n = normalizeDiecastScale(raw);
    if (!n) {
      finishShopListingProfile(profile, { ok: false, reason: "invalid_diecast" });
      return { ok: false, error: "Invalid diecast scale filter", status: 400 };
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
      return { ok: true, data };
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
      return { ok: true, data };
    }
    (where as { subtype_id?: { in: string[] } }).subtype_id = { in: sRows.map((s) => s.id) };
  }
  if (cRows !== null) {
    if (cRows.length === 0) {
      const data = emptyListingData(page, pageSize);
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "collection" });
      return { ok: true, data };
    }
    (where as { collection_id?: { in: string[] } }).collection_id = { in: cRows.map((c) => c.id) };
  }
  if (brandIds !== null) {
    if (brandIds.length === 0) {
      const data = emptyListingData(page, pageSize);
      finishShopListingProfile(profile, { ok: true, total: 0, empty: "brand" });
      return { ok: true, data };
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

  const facets = includeFacets
    ? await loadListingFacets(facetCacheParams, {
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
      })
    : emptyFacetsBundle;

  const listingSelect = {
    id: true,
    name: true,
    short_description: true,
    base_price: true,
    discounted_price: true,
    age_group: true,
    diecast_scales: { select: { ratio: true } },
    slug: true,
    updated_at: true,
    sku: true,
    shipping_per_unit: true,
    product_images: { select: { url: true, sort_order: true } },
    product_variants: {
      select: {
        name: true,
        color: true,
        size: true,
        is_default: true,
        product_images: { select: { url: true }, orderBy: { sort_order: "asc" as const }, take: 1 },
      },
    },
    inventory: { select: { available_quantity: true } },
  } as const;

  let total: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: any[];

  if (discountParams.length > 0) {
    const candidateRows = await profiledQuery(profile, "listing.discountCandidates", () =>
      prisma.products.findMany({
        where: where as never,
        select: { id: true },
      })
    );
    const candidateIds = candidateRows.map((r) => r.id);
    const sortPriceKey =
      sortPrice === "price_asc" ? "price_asc" : sortPrice === "price_desc" ? "price_desc" : null;
    const { ids: pageIds, total: discountTotal } = await profiledQuery(
      profile,
      "listing.discountPaginate",
      () =>
        paginateDiscountFilteredProductIds({
          candidateIds,
          discountKeys: discountParams,
          skip,
          take: pageSize,
          sortPrice: sortPriceKey,
        })
    );
    total = discountTotal;
    if (pageIds.length === 0) {
      products = [];
    } else {
      const reordered = await profiledQuery(profile, "listing.discountPage", () =>
        prisma.products.findMany({
          where: { id: { in: pageIds } },
          select: listingSelect,
        })
      );
      const order = new Map(pageIds.map((id, i) => [id, i] as const));
      reordered.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      products = reordered;
    }
  } else {
    const [c, prows] = await Promise.all([
      profiledQuery(profile, "listing.count", () =>
        prisma.products.count({ where: where as never })
      ),
      profiledQuery(profile, "listing.page", () =>
        prisma.products.findMany({
          where: where as never,
          orderBy,
          skip,
          take: pageSize,
          select: listingSelect,
        })
      ),
    ]);
    total = c;
    products = prows;
  }

  const productIds = products.map((p) => p.id);
  const flashRows = await profiledQuery(profile, "listing.flashSales", () =>
    prisma.flash_sale_products.findMany({
      where: { product_id: { in: productIds }, is_active: true },
      select: {
        product_id: true,
        sale_price: true,
        is_active: true,
        active_from: true,
        active_until: true,
      },
    })
  );
  const flashMap = new Map<string, number>();
  for (const row of flashRows) {
    if (isActiveInWindow(row.is_active, row.active_from, row.active_until, now)) {
      flashMap.set(row.product_id, Number(row.sale_price));
    }
  }

  const finalItems = mapProductsToItems(products, flashMap);

  finishShopListingProfile(profile, {
    ok: true,
    total,
    page,
    pageSize,
    hasSearch: Boolean(q),
    categoryCount: categorySlugs.length,
    discountFilter: discountParams.length > 0,
    elapsedMs: Date.now() - startedAt,
  });

  return {
    ok: true,
    data: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      ageGroups: facets.ageGroups,
      diecastScales: facets.diecastScales,
      brands: facets.brands,
      productSubtypes: facets.productSubtypes,
      productCollections: facets.productCollections,
      discountBuckets: facets.discountBuckets,
      items: finalItems,
    },
  };
}
