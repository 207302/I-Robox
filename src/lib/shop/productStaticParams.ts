import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";

/**
 * Max PDPs pre-rendered at build. All other slugs use ISR on first request (`dynamicParams`).
 * Override: `STATIC_PDP_BUILD_LIMIT=0` skips build prerender entirely.
 */
export const STATIC_PDP_BUILD_LIMIT = 40;

const ABSOLUTE_MAX = 50;

function resolveBuildLimit(): number {
  const raw = process.env.STATIC_PDP_BUILD_LIMIT?.trim();
  if (raw === "0") return 0;
  if (raw && /^\d+$/.test(raw)) {
    return Math.min(ABSOLUTE_MAX, Math.max(1, parseInt(raw, 10)));
  }
  return STATIC_PDP_BUILD_LIMIT;
}

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

/** Active flash-sale PDPs. */
async function flashSaleSlugs(now: Date, take: number): Promise<string[]> {
  const rows = await prisma.flash_sale_products.findMany({
    where: { is_active: true },
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
  const cap = resolveBuildLimit();
  if (cap === 0) {
    console.info("[productStaticParams] build prerender skipped (STATIC_PDP_BUILD_LIMIT=0)");
    return [];
  }

  try {
    const now = new Date();
    const slugs = new Set<string>();

    // Sequential queries — gentle on Neon during `generateStaticParams` (one connection).
    addSlugs(slugs, await bestSellerSlugs(20), cap);
    if (slugs.size < cap) addSlugs(slugs, await highlightProductSlugs(now, 20), cap);
    if (slugs.size < cap) addSlugs(slugs, await flashSaleSlugs(now, 10), cap);
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
