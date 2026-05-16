import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DiscountBucketCounts = {
  on_sale: number;
  b10: number;
  b25: number;
  b50: number;
  b100: number;
};

const EMPTY_BUCKETS: DiscountBucketCounts = {
  on_sale: 0,
  b10: 0,
  b25: 0,
  b50: 0,
  b100: 0,
};

/** All diecast scale ratios — changes rarely. */
export const getCachedDiecastScales = unstable_cache(
  async () => {
    const rows = await prisma.diecast_scales.findMany({
      select: { ratio: true },
      orderBy: { ratio: "asc" },
    });
    return rows.map((r) => r.ratio).filter(Boolean);
  },
  ["shop-facets-diecast-scales"],
  { revalidate: 120 }
);

/**
 * Global discount bucket counts (active + in-stock) via SQL — no 8000-row ORM scan.
 */
export const getCachedGlobalDiscountBuckets = unstable_cache(
  async (): Promise<DiscountBucketCounts> => {
    try {
      const rows = await prisma.$queryRaw<
        [{ on_sale: bigint; b10: bigint; b25: bigint; b50: bigint; b100: bigint }]
      >(Prisma.sql`
        WITH priced AS (
          SELECT
            p.id,
            p.base_price::float8 AS base_price,
            CASE
              WHEN f.id IS NOT NULL
                AND f.is_active = true
                AND (f.active_from IS NULL OR f.active_from <= NOW())
                AND (f.active_until IS NULL OR f.active_until >= NOW())
              THEN f.sale_price::float8
              WHEN p.discounted_price IS NOT NULL THEN p.discounted_price::float8
              ELSE p.base_price::float8
            END AS eff_price
          FROM products p
          LEFT JOIN flash_sale_products f ON f.product_id = p.id
          WHERE p.is_active = true
            AND EXISTS (
              SELECT 1 FROM inventory i
              WHERE i.product_id = p.id AND i.available_quantity > 0
            )
        ),
        scored AS (
          SELECT
            CASE
              WHEN base_price > 0
              THEN ((base_price - eff_price) / base_price) * 100.0
              ELSE 0
            END AS pct
          FROM priced
        )
        SELECT
          COUNT(*) FILTER (WHERE pct > 0.1)::bigint AS on_sale,
          COUNT(*) FILTER (WHERE pct > 0.1 AND pct <= 10.0001)::bigint AS b10,
          COUNT(*) FILTER (WHERE pct > 10.0001 AND pct <= 25.0001)::bigint AS b25,
          COUNT(*) FILTER (WHERE pct > 25.0001 AND pct <= 50.0001)::bigint AS b50,
          COUNT(*) FILTER (WHERE pct > 50.0001)::bigint AS b100
        FROM scored
      `);
      const row = rows[0];
      if (!row) return EMPTY_BUCKETS;
      return {
        on_sale: Number(row.on_sale),
        b10: Number(row.b10),
        b25: Number(row.b25),
        b50: Number(row.b50),
        b100: Number(row.b100),
      };
    } catch (err) {
      console.error("[shopFacets] discount bucket aggregate failed", err);
      return EMPTY_BUCKETS;
    }
  },
  ["shop-facets-discount-buckets"],
  { revalidate: 120 }
);

/** Filtered bucket counts for a subset of product ids (single SQL aggregate). */
export async function computeDiscountBucketsForProductIds(
  productIds: string[]
): Promise<DiscountBucketCounts> {
  if (productIds.length === 0) return EMPTY_BUCKETS;
  try {
    const rows = await prisma.$queryRaw<
      [{ on_sale: bigint; b10: bigint; b25: bigint; b50: bigint; b100: bigint }]
    >(Prisma.sql`
      WITH priced AS (
        SELECT
          p.id,
          p.base_price::float8 AS base_price,
          CASE
            WHEN f.id IS NOT NULL
              AND f.is_active = true
              AND (f.active_from IS NULL OR f.active_from <= NOW())
              AND (f.active_until IS NULL OR f.active_until >= NOW())
            THEN f.sale_price::float8
            WHEN p.discounted_price IS NOT NULL THEN p.discounted_price::float8
            ELSE p.base_price::float8
          END AS eff_price
        FROM products p
        LEFT JOIN flash_sale_products f ON f.product_id = p.id
        WHERE p.id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
      ),
      scored AS (
        SELECT
          CASE
            WHEN base_price > 0
            THEN ((base_price - eff_price) / base_price) * 100.0
            ELSE 0
          END AS pct
        FROM priced
      )
      SELECT
        COUNT(*) FILTER (WHERE pct > 0.1)::bigint AS on_sale,
        COUNT(*) FILTER (WHERE pct > 0.1 AND pct <= 10.0001)::bigint AS b10,
        COUNT(*) FILTER (WHERE pct > 10.0001 AND pct <= 25.0001)::bigint AS b25,
        COUNT(*) FILTER (WHERE pct > 25.0001 AND pct <= 50.0001)::bigint AS b50,
        COUNT(*) FILTER (WHERE pct > 50.0001)::bigint AS b100
      FROM scored
    `);
    const row = rows[0];
    if (!row) return EMPTY_BUCKETS;
    return {
      on_sale: Number(row.on_sale),
      b10: Number(row.b10),
      b25: Number(row.b25),
      b50: Number(row.b50),
      b100: Number(row.b100),
    };
  } catch (err) {
    console.error("[shopFacets] filtered discount buckets failed", err);
    return EMPTY_BUCKETS;
  }
}

export function discountBucketsFromCounts(bucket: DiscountBucketCounts) {
  return [
    { id: "on_sale", label: "On sale", count: bucket.on_sale },
    { id: "b10", label: "Up to 10% off", count: bucket.b10 },
    { id: "b25", label: "10% – 25% off", count: bucket.b25 },
    { id: "b50", label: "25% – 50% off", count: bucket.b50 },
    { id: "b100", label: "50%+ off", count: bucket.b100 },
  ];
}

function discountPctSqlPredicate(keys: string[]): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const key of keys) {
    if (key === "on_sale") parts.push(Prisma.sql`pct > 0.1`);
    else if (key === "b10") parts.push(Prisma.sql`(pct > 0.1 AND pct <= 10.0001)`);
    else if (key === "b25") parts.push(Prisma.sql`(pct > 10.0001 AND pct <= 25.0001)`);
    else if (key === "b50") parts.push(Prisma.sql`(pct > 25.0001 AND pct <= 50.0001)`);
    else if (key === "b100") parts.push(Prisma.sql`pct > 50.0001`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  return Prisma.join(parts, " OR ");
}

/**
 * Paginate product ids matching discount bucket filters (SQL-side, no full row hydration).
 */
export async function paginateDiscountFilteredProductIds(input: {
  candidateIds: string[];
  discountKeys: string[];
  skip: number;
  take: number;
  sortPrice: "price_asc" | "price_desc" | null;
}): Promise<{ ids: string[]; total: number }> {
  const { candidateIds, discountKeys, skip, take, sortPrice } = input;
  if (candidateIds.length === 0 || discountKeys.length === 0) {
    return { ids: [], total: 0 };
  }

  const bucketWhere = discountPctSqlPredicate(discountKeys);
  const orderSql =
    sortPrice === "price_asc"
      ? Prisma.sql`eff_price ASC, updated_at DESC`
      : sortPrice === "price_desc"
        ? Prisma.sql`eff_price DESC, updated_at DESC`
        : Prisma.sql`updated_at DESC`;

  try {
    const countRows = await prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
      WITH priced AS (
        SELECT
          p.id,
          p.base_price::float8 AS base_price,
          p.updated_at,
          CASE
            WHEN f.id IS NOT NULL
              AND f.is_active = true
              AND (f.active_from IS NULL OR f.active_from <= NOW())
              AND (f.active_until IS NULL OR f.active_until >= NOW())
            THEN f.sale_price::float8
            WHEN p.discounted_price IS NOT NULL THEN p.discounted_price::float8
            ELSE p.base_price::float8
          END AS eff_price
        FROM products p
        LEFT JOIN flash_sale_products f ON f.product_id = p.id
        WHERE p.id IN (${Prisma.join(candidateIds.map((id) => Prisma.sql`${id}::uuid`))})
      ),
      scored AS (
        SELECT
          id,
          updated_at,
          eff_price,
          CASE
            WHEN base_price > 0
            THEN ((base_price - eff_price) / base_price) * 100.0
            ELSE 0
          END AS pct
        FROM priced
      )
      SELECT COUNT(*)::bigint AS total
      FROM scored
      WHERE ${bucketWhere}
    `);

    const total = Number(countRows[0]?.total ?? 0);
    if (total === 0) return { ids: [], total: 0 };

    const pageRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH priced AS (
        SELECT
          p.id,
          p.base_price::float8 AS base_price,
          p.updated_at,
          CASE
            WHEN f.id IS NOT NULL
              AND f.is_active = true
              AND (f.active_from IS NULL OR f.active_from <= NOW())
              AND (f.active_until IS NULL OR f.active_until >= NOW())
            THEN f.sale_price::float8
            WHEN p.discounted_price IS NOT NULL THEN p.discounted_price::float8
            ELSE p.base_price::float8
          END AS eff_price
        FROM products p
        LEFT JOIN flash_sale_products f ON f.product_id = p.id
        WHERE p.id IN (${Prisma.join(candidateIds.map((id) => Prisma.sql`${id}::uuid`))})
      ),
      scored AS (
        SELECT
          id,
          updated_at,
          eff_price,
          CASE
            WHEN base_price > 0
            THEN ((base_price - eff_price) / base_price) * 100.0
            ELSE 0
          END AS pct
        FROM priced
      )
      SELECT id
      FROM scored
      WHERE ${bucketWhere}
      ORDER BY ${orderSql}
      LIMIT ${take} OFFSET ${skip}
    `);

    return { ids: pageRows.map((r) => r.id), total };
  } catch (err) {
    console.error("[shopFacets] paginateDiscountFilteredProductIds failed", err);
    return { ids: [], total: 0 };
  }
}
