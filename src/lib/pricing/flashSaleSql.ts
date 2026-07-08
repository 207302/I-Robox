import { Prisma } from "@prisma/client";

/**
 * SQL subquery: lowest active flash-sale unit price for a product row alias `p`,
 * or NULL when no rule applies.
 */
export const flashSaleUnitPriceSubquery = Prisma.sql`
  (
    SELECT MIN(
      CASE
        WHEN fs.discount_type = 'FIXED' THEN fs.discount_value::float8
        ELSE (
          COALESCE(p.discounted_price, p.base_price)::float8
          * (1.0 - fs.discount_value::float8 / 100.0)
        )
      END
    )
    FROM flash_sales fs
    WHERE fs.is_active = true
      AND (fs.active_from IS NULL OR fs.active_from <= NOW())
      AND (fs.active_until IS NULL OR fs.active_until >= NOW())
      AND (
        EXISTS (
          SELECT 1 FROM flash_sale_products fsp
          WHERE fsp.flash_sale_id = fs.id AND fsp.product_id = p.id
        )
        OR EXISTS (
          SELECT 1 FROM flash_sale_categories fsc
          WHERE fsc.flash_sale_id = fs.id AND fsc.category_id = p.category_id
        )
        OR EXISTS (
          SELECT 1 FROM flash_sale_brands fsb
          WHERE fsb.flash_sale_id = fs.id AND fsb.brand_id = p.brand_id
        )
      )
  )
`;

/** Effective retail unit price with flash override when present. */
export const effectiveRetailPriceExpr = Prisma.sql`
  COALESCE(
    ${flashSaleUnitPriceSubquery},
    p.discounted_price::float8,
    p.base_price::float8
  )
`;

export async function productIdsInEffectivePriceRange(
  minP: number | null,
  maxP: number | null
): Promise<string[]> {
  if (minP === null && maxP === null) return [];
  const { prisma } = await import("@/lib/prisma");
  const filters: Prisma.Sql[] = [Prisma.sql`p.is_active = true`];
  if (minP !== null) filters.push(Prisma.sql`${effectiveRetailPriceExpr} >= ${minP}`);
  if (maxP !== null) filters.push(Prisma.sql`${effectiveRetailPriceExpr} <= ${maxP}`);
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id
    FROM products p
    WHERE ${Prisma.join(filters, " AND ")}
  `);
  return rows.map((r) => r.id);
}
