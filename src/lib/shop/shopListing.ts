import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeDiecastScale } from "@/lib/products/diecastScales";
import { cleanText, hasSuspiciousInput, isUrlSlug } from "@/lib/validation/input";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  computeDiscountBucketsForProductIds,
  discountBucketsFromCounts,
  getCachedDiecastScales,
  getCachedGlobalDiscountBuckets,
  paginateDiscountFilteredProductIds,
} from "@/lib/shop/shopFacets";

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
  /** Distinct `1:n` scales in the catalog for filter UI */
  diecastScales: string[];
  /** Brands (active + in-stock counts; facet excludes current brand filter). */
  brands: { slug: string; name: string; count: number }[];
  /** Facet rows use active + in-stock counts only. */
  productTypes: { slug: string; name: string; count: number }[];
  productSubtypes: { slug: string; name: string; count: number }[];
  productCollections: { slug: string; name: string; count: number }[];
  /** Fixed discount bucket ids: b10, b25, b50, b100, on_sale */
  discountBuckets: { id: string; label: string; count: number }[];
  items: ShopListingItem[];
};

function toInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
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

function normalizeSearchTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function getSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const noSpaces = trimmed.replace(/\s+/g, "");
  const withSpaces = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");
  const spaced = noSpaces.replace(/([a-z]{2,})([a-z])/g, (_, a, b) => `${a} ${b}`);

  return [...new Set([trimmed, noSpaces, withSpaces, spaced])].filter(Boolean);
}

/** Step 1: space-stripped + spaced ILIKE on product, brand, category (and descriptions). */
async function resolveNormalizedIlikeSearchIds(rawQ: string): Promise<string[]> {
  const compact = normalizeSearchTerm(rawQ);
  const spaced = rawQ.toLowerCase().trim();
  if (!compact && !spaced) return [];

  const compactPattern = `%${escapeIlikePattern(compact)}%`;
  const spacedPattern = `%${escapeIlikePattern(spaced)}%`;

  const extraSpacedPatterns = getSearchVariants(rawQ)
    .map((v) => v.toLowerCase().trim())
    .filter((v) => v.length > 0 && v !== spaced && v !== compact)
    .slice(0, 4)
    .map((v) => `%${escapeIlikePattern(v)}%`);

  const extraClauseParts = extraSpacedPatterns.flatMap((pattern) => [
    Prisma.sql`OR LOWER(p.name) ILIKE ${pattern}`,
    Prisma.sql`OR LOWER(COALESCE(b.name, '')) ILIKE ${pattern}`,
    Prisma.sql`OR LOWER(COALESCE(p.short_description, '')) ILIKE ${pattern}`,
  ]);
  const extraClauses =
    extraClauseParts.length > 0 ? Prisma.join(extraClauseParts, " ") : Prisma.sql``;

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT DISTINCT p.id
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
      AND (
        LOWER(REPLACE(p.name, ' ', '')) ILIKE ${compactPattern}
        OR LOWER(REPLACE(COALESCE(p.short_description, ''), ' ', '')) ILIKE ${compactPattern}
        OR LOWER(REPLACE(COALESCE(p.description, ''), ' ', '')) ILIKE ${compactPattern}
        OR LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')) ILIKE ${compactPattern}
        OR LOWER(REPLACE(COALESCE(c.name, ''), ' ', '')) ILIKE ${compactPattern}
        OR LOWER(p.name) ILIKE ${spacedPattern}
        OR LOWER(COALESCE(p.short_description, '')) ILIKE ${spacedPattern}
        OR LOWER(COALESCE(p.description, '')) ILIKE ${spacedPattern}
        OR LOWER(COALESCE(b.name, '')) ILIKE ${spacedPattern}
        OR LOWER(COALESCE(c.name, '')) ILIKE ${spacedPattern}
        ${extraClauses}
      )
    LIMIT 200
  `);
  return rows.map((r) => r.id);
}

/** Step 2: search_vector full-text (stemming / token match). */
async function resolveFtsSearchIds(rawQ: string): Promise<string[]> {
  const variants = getSearchVariants(rawQ).filter((v) => /[a-z0-9]/i.test(v));
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const term of variants.slice(0, 5)) {
    try {
      const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id
        FROM products p
        WHERE p.is_active = true
          AND p.search_vector @@ plainto_tsquery('english', ${term})
        ORDER BY ts_rank(p.search_vector, plainto_tsquery('english', ${term})) DESC
        LIMIT 200
      `);
      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          ids.push(row.id);
          if (ids.length >= 200) return ids;
        }
      }
    } catch {
      // plainto_tsquery can fail on odd tokens; try next variant
    }
  }
  return ids;
}

/** Step 3: pg_trgm typo tolerance on normalized names (requires migration extension). */
async function resolveTrigramSearchIds(rawQ: string): Promise<string[]> {
  const compact = normalizeSearchTerm(rawQ);
  if (compact.length < 3) return [];

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.is_active = true
      AND (
        similarity(LOWER(REPLACE(p.name, ' ', '')), ${compact}) > 0.3
        OR similarity(LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')), ${compact}) > 0.3
        OR similarity(LOWER(REPLACE(COALESCE(p.short_description, ''), ' ', '')), ${compact}) > 0.3
      )
    ORDER BY GREATEST(
      similarity(LOWER(REPLACE(p.name, ' ', '')), ${compact}),
      similarity(LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')), ${compact}),
      similarity(LOWER(REPLACE(COALESCE(p.short_description, ''), ' ', '')), ${compact})
    ) DESC
    LIMIT 100
  `);
  return rows.map((r) => r.id);
}

/** Step 4: SKU exact match (product or variant). */
async function resolveSkuSearchIds(term: string): Promise<string[]> {
  const skuRows = await prisma.products.findMany({
    where: {
      is_active: true,
      OR: [
        { sku: { equals: term, mode: "insensitive" } },
        { product_variants: { some: { sku: { equals: term, mode: "insensitive" } } } },
      ],
    },
    select: { id: true },
    take: 200,
  });
  return skuRows.map((r) => r.id);
}

/**
 * Search waterfall — first non-empty result wins:
 * 1. Normalized ILIKE (hotwheels ↔ Hot Wheels)
 * 2. search_vector FTS
 * 3. Trigram similarity (typos)
 * 4. SKU exact
 */
async function resolveSearchProductIds(searchTerm: string): Promise<string[]> {
  const rawQ = searchTerm.trim();
  if (!rawQ) return [];

  try {
    const normalized = await resolveNormalizedIlikeSearchIds(rawQ);
    if (normalized.length > 0) return normalized;
  } catch (err) {
    console.error("[shopListing] normalized ILIKE search failed", err);
  }

  try {
    const fts = await resolveFtsSearchIds(rawQ);
    if (fts.length > 0) return fts;
  } catch (err) {
    console.error("[shopListing] full-text search failed", err);
  }

  try {
    const trgm = await resolveTrigramSearchIds(rawQ);
    if (trgm.length > 0) return trgm;
  } catch (err) {
    console.error("[shopListing] trigram search failed", err);
  }

  try {
    return await resolveSkuSearchIds(rawQ);
  } catch (err) {
    console.error("[shopListing] SKU search failed", err);
    return [];
  }
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

/** Plural/singular and case variants so e.g. diecast-car still matches diecast-cars rows. */
function slugMatchOrClause(slug: string) {
  const s = slug.trim();
  const lower = s.toLowerCase();
  const variants = new Set<string>([s, lower]);
  if (!lower.endsWith("s")) variants.add(`${lower}s`);
  if (lower.endsWith("s") && lower.length > 2) variants.add(lower.slice(0, -1));
  return [...variants].map((v) => ({ slug: { equals: v, mode: "insensitive" as const } }));
}

/** All category ids in the subtree rooted at rootId (includes root). */
async function collectDescendantCategoryIds(rootId: string): Promise<string[]> {
  const all = await prisma.categories.findMany({
    select: { id: true, parent_id: true },
  });
  const childrenByParent = new Map<string | null, string[]>();
  for (const c of all) {
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
    childrenByParent.get(c.parent_id)!.push(c.id);
  }
  const out = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const kid of childrenByParent.get(id) ?? []) {
      if (!out.has(kid)) {
        out.add(kid);
        queue.push(kid);
      }
    }
  }
  return [...out];
}

async function categoryIdsForFilter(slug: string): Promise<string[] | null> {
  let roots = await prisma.categories.findMany({
    where: { OR: slugMatchOrClause(slug) },
    select: { id: true },
  });
  // e.g. highlight URL uses "diecast-car" but DB slug is "die-cast-cars" (no variant overlap)
  if (roots.length === 0) {
    const firstSegment = slug.split("-").filter(Boolean)[0] ?? "";
    if (firstSegment.length >= 3) {
      roots = await prisma.categories.findMany({
        where: { slug: { contains: firstSegment, mode: "insensitive" } },
        select: { id: true },
        take: 25,
      });
    }
  }
  if (roots.length === 0) return null;
  const idSet = new Set<string>();
  for (const r of roots) {
    for (const id of await collectDescendantCategoryIds(r.id)) idSet.add(id);
  }
  return [...idSet];
}

async function brandIdForFilter(slug: string): Promise<string | null> {
  const row = await prisma.brands.findFirst({
    where: { OR: slugMatchOrClause(slug) },
    select: { id: true },
  });
  return row?.id ?? null;
}

function mapProductsToItems(
  products: {
    id: string;
    name: string;
    short_description: string | null;
    description: string | null;
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
      description: p.description ?? "",
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
export async function getShopListing(usp: URLSearchParams): Promise<ShopListingResult> {
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
    return { ok: false, error: "Invalid search query", status: 400 };
  }
  for (const cat of categorySlugs) {
    if (!isUrlSlug(cat)) {
      return { ok: false, error: "Invalid category filter", status: 400 };
    }
  }
  for (const brand of brandSlugs) {
    if (!isUrlSlug(brand)) {
      return { ok: false, error: "Invalid brand filter", status: 400 };
    }
  }
  for (const ageGroup of ageGroups) {
    if (ageGroup && hasSuspiciousInput(ageGroup)) {
      return { ok: false, error: "Invalid age group filter", status: 400 };
    }
  }

  const minP = minPrice !== null && minPrice !== "" ? Number(minPrice) : null;
  const maxP = maxPrice !== null && maxPrice !== "" ? Number(maxPrice) : null;
  if ((minP !== null && !Number.isFinite(minP)) || (maxP !== null && !Number.isFinite(maxP))) {
    return { ok: false, error: "Invalid price filter", status: 400 };
  }
  if ((minP !== null && minP < 0) || (maxP !== null && maxP < 0)) {
    return { ok: false, error: "Invalid price filter", status: 400 };
  }
  const availableOnly = (usp.get("available") ?? "").trim() === "true";

  const typeSlugs = [...new Set(usp.getAll("type").map((s) => cleanText(s, 160)).filter(Boolean))];
  const subtypeSlugs = [...new Set(usp.getAll("subtype").map((s) => cleanText(s, 160)).filter(Boolean))];
  const collectionSlugs = [...new Set(usp.getAll("collection").map((s) => cleanText(s, 160)).filter(Boolean))];
  const discountParams = [...new Set(usp.getAll("discount").map((s) => cleanText(s, 32)).filter(Boolean))];
  for (const typeSlug of typeSlugs) {
    if (!isUrlSlug(typeSlug)) {
      return { ok: false, error: "Invalid type filter", status: 400 };
    }
  }
  for (const subtypeSlug of subtypeSlugs) {
    if (!isUrlSlug(subtypeSlug)) {
      return { ok: false, error: "Invalid subtype filter", status: 400 };
    }
  }
  for (const collectionSlug of collectionSlugs) {
    if (!isUrlSlug(collectionSlug)) {
      return { ok: false, error: "Invalid collection filter", status: 400 };
    }
  }
  for (const discountParam of discountParams) {
    if (!/^(b10|b25|b50|b100|on_sale)$/.test(discountParam)) {
      return { ok: false, error: "Invalid discount filter", status: 400 };
    }
  }

  const sortRaw = cleanText(usp.get("sort") ?? "", 32);
  const sortPrice =
    sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : null;
  if (sortRaw && !sortPrice) {
    return { ok: false, error: "Invalid sort", status: 400 };
  }

  const page = Math.max(1, toInt(usp.get("page"), 1));
  const pageSize = Math.min(24, Math.max(6, toInt(usp.get("pageSize"), 12)));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { is_active: true };
  if (q) {
    const searchIds = await resolveSearchProductIds(q);
    if (searchIds.length === 0) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: discountBucketsFromCounts(await getCachedGlobalDiscountBuckets()),
          items: [],
        },
      };
    }
    where.id = { in: searchIds };
  }
  if (ageGroups.length) where.age_group = { in: ageGroups };
  const diecastNorms: string[] = [];
  for (const raw of diecastScaleRawList) {
    const n = normalizeDiecastScale(raw);
    if (!n) return { ok: false, error: "Invalid diecast scale filter", status: 400 };
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
    const idSet = new Set<string>();
    for (const slug of categorySlugs) {
      const categoryIds = await categoryIdsForFilter(slug);
      if (categoryIds) {
        for (const id of categoryIds) idSet.add(id);
      }
    }
    if (idSet.size === 0) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    where.category_id = { in: [...idSet] };
    selectedCategoryIdSet = idSet;
  }

  if (typeSlugs.length) {
    const tRows = await prisma.product_types.findMany({
      where: { is_active: true, OR: typeSlugs.flatMap((s) => slugMatchOrClause(s)) },
      select: { id: true, category_id: true },
    });
    if (tRows.length === 0) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    if (selectedCategoryIdSet && !tRows.some((t) => selectedCategoryIdSet.has(t.category_id))) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    (where as { type_id?: { in: string[] } }).type_id = { in: tRows.map((t) => t.id) };
  }

  if (subtypeSlugs.length) {
    const sRows = await prisma.product_subtypes.findMany({
      where: { is_active: true, OR: subtypeSlugs.flatMap((s) => slugMatchOrClause(s)) },
      select: { id: true, product_type_id: true },
    });
    if (sRows.length === 0) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    const tIn = (where as { type_id?: { in: string[] } }).type_id?.in ?? [];
    if (tIn.length && !sRows.every((s) => tIn.includes(s.product_type_id))) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    (where as { subtype_id?: { in: string[] } }).subtype_id = { in: sRows.map((s) => s.id) };
  }

  if (collectionSlugs.length) {
    const cRows = await prisma.product_collections.findMany({
      where: { is_active: true, OR: collectionSlugs.flatMap((s) => slugMatchOrClause(s)) },
      select: { id: true },
    });
    if (cRows.length === 0) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    (where as { collection_id?: { in: string[] } }).collection_id = { in: cRows.map((c) => c.id) };
  }

  if (brandSlugs.length) {
    const ids = (
      await Promise.all(brandSlugs.map((brand) => brandIdForFilter(brand)))
    ).filter((x): x is string => Boolean(x));
    if (ids.length === 0) {
      return {
        ok: true,
        data: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          ageGroups: [],
          diecastScales: [],
          brands: [],
          productTypes: [],
          productSubtypes: [],
          productCollections: [],
          discountBuckets: [],
          items: [],
        },
      };
    }
    where.brand_id = { in: ids };
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
  const wNoType: Prisma.productsWhereInput = { ...fw };
  const typeIdInWhere = (where as { type_id?: { in?: string[] } }).type_id?.in ?? [];
  const subtypeIdsInWhere = (where as { subtype_id?: { in?: string[] } }).subtype_id?.in ?? [];
  let resolvedTypeIdsForSubtypes = [...typeIdInWhere];
  if (resolvedTypeIdsForSubtypes.length === 0 && subtypeIdsInWhere.length > 0) {
    const sMeta = await prisma.product_subtypes.findMany({
      where: { id: { in: subtypeIdsInWhere } },
      select: { product_type_id: true },
    });
    resolvedTypeIdsForSubtypes = [...new Set(sMeta.map((s) => s.product_type_id))];
  }

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
    typeSlugs.length > 0 ||
    subtypeSlugs.length > 0 ||
    collectionSlugs.length > 0 ||
    minP !== null ||
    maxP !== null ||
    availableOnly;

  const [ageGroupsRaw, typeGroups, subGroups, colGroups, brandIdGroups, diecastScalesCached, discountBucketCounts] =
    await Promise.all([
      prisma.products.findMany({
        where: { ...wNoAge, age_group: { not: null } },
        distinct: ["age_group"],
        select: { age_group: true },
        orderBy: { age_group: "asc" },
      }),
      prisma.products.groupBy({
        by: ["type_id"],
        where: { ...wNoType, type_id: { not: null } } as never,
        _count: { _all: true },
      }),
      resolvedTypeIdsForSubtypes.length > 0
        ? prisma.products.groupBy({
            by: ["subtype_id"],
            where: {
              ...wNoType,
              type_id: { in: resolvedTypeIdsForSubtypes },
              subtype_id: { not: null },
            } as never,
            _count: { _all: true },
          })
        : Promise.resolve([] as { subtype_id: string; _count: { _all: number } }[]),
      prisma.products.groupBy({
        by: ["collection_id"],
        where: { ...wNoType, collection_id: { not: null } } as never,
        _count: { _all: true },
      }),
      prisma.products.groupBy({
        by: ["brand_id"],
        where: { ...brandFacetWhere, brand_id: { not: null } } as never,
        _count: { _all: true },
      }),
      getCachedDiecastScales(),
      hasHeavyFilters
        ? prisma.products
            .findMany({ where: fw, select: { id: true } })
            .then((rows) => computeDiscountBucketsForProductIds(rows.map((r) => r.id)))
        : getCachedGlobalDiscountBuckets(),
    ]);

  const typeIdList = typeGroups
    .map((g) => g.type_id)
    .filter((v): v is string => v !== null);
  const typeRows = typeIdList.length
    ? await prisma.product_types.findMany({
        where: { id: { in: typeIdList }, is_active: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    : [];
  const tCount = new Map(typeGroups.map((g) => [g.type_id, g._count._all] as const));
  const productTypes: { slug: string; name: string; count: number }[] = typeRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: tCount.get(r.id) ?? 0,
  }));

  const subIdList = subGroups.map((g) => g.subtype_id).filter((v): v is string => v !== null);
  const subRows = subIdList.length
    ? await prisma.product_subtypes.findMany({
        where: { id: { in: subIdList } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    : [];
  const sCount = new Map(subGroups.map((g) => [g.subtype_id, g._count._all] as const));
  const productSubtypes: { slug: string; name: string; count: number }[] = subRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: sCount.get(r.id) ?? 0,
  }));

  const colIdList = colGroups.map((g) => g.collection_id).filter((v): v is string => v !== null);
  const colRows = colIdList.length
    ? await prisma.product_collections.findMany({
        where: { id: { in: colIdList } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    : [];
  const cCount = new Map(colGroups.map((g) => [g.collection_id, g._count._all] as const));
  const productCollections: { slug: string; name: string; count: number }[] = colRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    count: cCount.get(r.id) ?? 0,
  }));

  const discountBuckets = discountBucketsFromCounts(discountBucketCounts);

  const brandIdsFromGroups = brandIdGroups.map((g) => g.brand_id).filter((v): v is string => v !== null);
  const brandsIfAny = brandIdsFromGroups.length
    ? await prisma.brands.findMany({
        where: { id: { in: brandIdsFromGroups } },
        select: { id: true, slug: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const bCount = new Map(brandIdGroups.map((g) => [g.brand_id, g._count._all] as const));
  const brandsWithCounts: { slug: string; name: string; count: number }[] = brandsIfAny.map((b) => ({
    slug: b.slug,
    name: b.name,
    count: bCount.get(b.id) ?? 0,
  }));
  const brandsRaw = brandsWithCounts;

  const listingSelect = {
    id: true,
    name: true,
    short_description: true,
    description: true,
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
    const candidateRows = await prisma.products.findMany({
      where: where as never,
      select: { id: true },
    });
    const candidateIds = candidateRows.map((r) => r.id);
    const sortPriceKey =
      sortPrice === "price_asc" ? "price_asc" : sortPrice === "price_desc" ? "price_desc" : null;
    const { ids: pageIds, total: discountTotal } = await paginateDiscountFilteredProductIds({
      candidateIds,
      discountKeys: discountParams,
      skip,
      take: pageSize,
      sortPrice: sortPriceKey,
    });
    total = discountTotal;
    if (pageIds.length === 0) {
      products = [];
    } else {
      const reordered = await prisma.products.findMany({
        where: { id: { in: pageIds } },
        select: listingSelect,
      });
      const order = new Map(pageIds.map((id, i) => [id, i] as const));
      reordered.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      products = reordered;
    }
  } else {
    const [c, prows] = await Promise.all([
      prisma.products.count({ where: where as never }),
      prisma.products.findMany({
        where: where as never,
        orderBy,
        skip,
        take: pageSize,
        select: listingSelect,
      }),
    ]);
    total = c;
    products = prows;
  }

  const productIds = products.map((p) => p.id);
  const flashRows = await prisma.flash_sale_products.findMany({
    where: { product_id: { in: productIds }, is_active: true },
    select: {
      product_id: true,
      sale_price: true,
      is_active: true,
      active_from: true,
      active_until: true,
    },
  });
  const flashMap = new Map<string, number>();
  for (const row of flashRows) {
    if (isActiveInWindow(row.is_active, row.active_from, row.active_until, now)) {
      flashMap.set(row.product_id, Number(row.sale_price));
    }
  }

  const finalItems = mapProductsToItems(products, flashMap);
  const finalTotal = total;

  let brandsForUi = brandsRaw.map((b) => ({
    slug: b.slug,
    name: b.name,
    count: b.count,
  }));
  for (const brandFilter of brandSlugs) {
    const lower = brandFilter.toLowerCase();
    if (!brandsForUi.some((b) => b.slug.toLowerCase() === lower)) {
      const row = await prisma.brands.findFirst({
        where: { OR: slugMatchOrClause(brandFilter) },
        select: { slug: true, name: true },
      });
      if (row) {
        brandsForUi = [...brandsForUi, { ...row, count: 0 }].sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }

  return {
    ok: true,
    data: {
      page,
      pageSize,
      total: finalTotal,
      totalPages: Math.max(1, Math.ceil(finalTotal / pageSize)),
      ageGroups: ageGroupsRaw
        .map((x) => x.age_group)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
      diecastScales: (() => {
        const merged = [...new Set([...diecastNorms, ...diecastScalesCached])];
        return merged.sort((a, b) => {
          const na = parseInt(a.replace(/^1:/i, ""), 10);
          const nb = parseInt(b.replace(/^1:/i, ""), 10);
          return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
        });
      })(),
      brands: brandsForUi,
      productTypes,
      productSubtypes,
      productCollections,
      discountBuckets,
      items: finalItems,
    },
  };
}
