import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { loadActiveFlashSaleRules } from "@/lib/pricing/flashSale";
import { productMatchesFlashSale } from "@/lib/pricing/flashSaleTypes";

/** Max PDPs pre-rendered at build. All other slugs use ISR on first request (`dynamicParams`). */
export const STATIC_PDP_BUILD_LIMIT = 10;

function addSlugs(target: Set<string>, slugs: string[], cap: number) {
  for (const slug of slugs) {
    const s = slug?.trim();
    if (!s || target.has(s)) continue;
    target.add(s);
    if (target.size >= cap) return;
  }
}

/** Best sellers by paid order quantity (same logic as homepage rail). */
async function bestSellerSlugs(take: number): Promise<string[]> {
  const soldRows = await prisma.$queryRaw<Array<{ slug: string }>>(Prisma.sql`
    SELECT p.slug
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN products p ON p.id = oi.product_id
    WHERE p.is_active = true
      AND o.payment_status = 'SUCCEEDED'
      AND o.status NOT IN ('CANCELLED', 'PAYMENT_FAILED', 'REFUNDED')
    GROUP BY p.slug
    ORDER BY SUM(oi.quantity) DESC
    LIMIT ${take}
  `);
  return soldRows.map((r) => r.slug).filter(Boolean);
}

/** Featured / trending / product highlights from marketing CMS. */
async function highlightProductSlugs(now: Date, take: number): Promise<string[]> {
  const rows = await prisma.homepage_highlights.findMany({
    where: { is_active: true, product_id: { not: null } },
    orderBy: { sort_order: "asc" },
    take,
    select: {
      is_active: true,
      active_from: true,
      active_until: true,
      products: { select: { slug: true, is_active: true } },
    },
  });

  const out: string[] = [];
  for (const row of rows) {
    if (!isActiveInWindow(row.is_active, row.active_from, row.active_until, now)) continue;
    const slug = row.products?.slug;
    if (!row.products?.is_active || !slug) continue;
    out.push(slug);
  }
  return out;
}

/** Active flash-sale PDPs (direct product targets + category/brand scope). */
async function flashSaleSlugs(now: Date, take: number): Promise<string[]> {
  const rules = await loadActiveFlashSaleRules(now);
  if (rules.length === 0) return [];

  const productIds = new Set<string>();
  const categoryIds = new Set<string>();
  const brandIds = new Set<string>();
  for (const rule of rules) {
    rule.product_ids.forEach((id) => productIds.add(id));
    rule.category_ids.forEach((id) => categoryIds.add(id));
    rule.brand_ids.forEach((id) => brandIds.add(id));
  }

  const or: Prisma.productsWhereInput[] = [];
  if (productIds.size) or.push({ id: { in: [...productIds] } });
  if (categoryIds.size) or.push({ category_id: { in: [...categoryIds] } });
  if (brandIds.size) or.push({ brand_id: { in: [...brandIds] } });
  if (or.length === 0) return [];

  const products = await prisma.products.findMany({
    where: { is_active: true, OR: or },
    select: { slug: true, id: true, category_id: true, brand_id: true },
    take: take * 4,
  });

  const out: string[] = [];
  for (const product of products) {
    const matches = rules.some((rule) => productMatchesFlashSale(product, rule));
    if (matches && product.slug) out.push(product.slug);
    if (out.length >= take) break;
  }
  return out;
}

/** Recent updates — fills remaining build slots when rails are sparse. */
async function recentProductSlugs(take: number, exclude: Set<string>): Promise<string[]> {
  const rows = await prisma.products.findMany({
    where: { is_active: true },
    select: { slug: true },
    orderBy: { updated_at: "desc" },
    take: take + exclude.size,
  });
  return rows.map((r) => r.slug).filter((s) => s && !exclude.has(s));
}

/**
 * Small, high-value slug set for build-time SSG only.
 * Runtime: `revalidate = 300` + `getProductBySlug` cache + `dynamicParams` for all other PDPs.
 */
export async function getProductSlugsForStaticGeneration(): Promise<{ slug: string }[]> {
  const cap = STATIC_PDP_BUILD_LIMIT;

  try {
    const now = new Date();
    const slugs = new Set<string>();

    const [best, highlights, flash] = await Promise.all([
      bestSellerSlugs(20),
      highlightProductSlugs(now, 20),
      flashSaleSlugs(now, 10),
    ]);
    addSlugs(slugs, best, cap);
    if (slugs.size < cap) addSlugs(slugs, highlights, cap);
    if (slugs.size < cap) addSlugs(slugs, flash, cap);
    if (slugs.size < cap) {
      addSlugs(slugs, await recentProductSlugs(cap - slugs.size, slugs), cap);
    }

    const result = [...slugs].map((slug) => ({ slug }));
    console.info(`[productStaticParams] build prerender ${result.length}/${cap} PDPs (ISR for the rest)`);
    return result;
  } catch (err) {
    console.error("[productStaticParams] build slug list failed:", err);
    return [];
  }
}
