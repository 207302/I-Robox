import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  bestFlashUnitPrice,
  type FlashProductContext,
  type FlashSaleRule,
} from "@/lib/pricing/flashSaleTypes";

const flashSaleInclude = {
  products: { select: { product_id: true } },
  categories: { select: { category_id: true } },
  brands: { select: { brand_id: true } },
} as const;

function mapFlashSaleRow(row: {
  id: string;
  discount_type: string;
  discount_value: { toString(): string } | number;
  is_active: boolean;
  active_from: Date | null;
  active_until: Date | null;
  products: { product_id: string }[];
  categories: { category_id: string }[];
  brands: { brand_id: string }[];
}): FlashSaleRule {
  return {
    id: row.id,
    discount_type: row.discount_type as FlashSaleRule["discount_type"],
    discount_value: Number(row.discount_value),
    is_active: row.is_active,
    active_from: row.active_from,
    active_until: row.active_until,
    product_ids: row.products.map((p) => p.product_id),
    category_ids: row.categories.map((c) => c.category_id),
    brand_ids: row.brands.map((b) => b.brand_id),
  };
}

export async function loadActiveFlashSaleRules(now = new Date()): Promise<FlashSaleRule[]> {
  const rows = await prisma.flash_sales.findMany({
    where: { is_active: true },
    include: flashSaleInclude,
    orderBy: { updated_at: "desc" },
  });
  return rows
    .map(mapFlashSaleRow)
    .filter((rule) => isActiveInWindow(rule.is_active, rule.active_from, rule.active_until, now));
}

/** Product id → flash sale unit price (lowest matching active rule). */
export async function flashSalePriceMap(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (productIds.length === 0) return map;

  const now = new Date();
  const rules = await loadActiveFlashSaleRules(now);
  if (rules.length === 0) return map;

  const products = await prisma.products.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      category_id: true,
      brand_id: true,
      base_price: true,
      discounted_price: true,
    },
  });

  const isLive = (rule: FlashSaleRule) =>
    isActiveInWindow(rule.is_active, rule.active_from, rule.active_until, now);

  for (const product of products) {
    const catalogUnit = Number(product.discounted_price ?? product.base_price);
    const ctx: FlashProductContext = {
      id: product.id,
      category_id: product.category_id,
      brand_id: product.brand_id,
      catalog_unit: catalogUnit,
    };
    const flashPrice = bestFlashUnitPrice(ctx, rules, isLive);
    if (flashPrice != null) map.set(product.id, flashPrice);
  }

  return map;
}

export function unitPriceWithFlashSale(
  catalogUnit: number,
  productId: string,
  flashMap: Map<string, number>
): number {
  const flash = flashMap.get(productId);
  return flash != null ? flash : catalogUnit;
}

export async function flashSaleUnitPriceForProduct(
  product: {
    id: string;
    category_id: string | null;
    brand_id: string | null;
    base_price: { toString(): string } | number;
    discounted_price: { toString(): string } | number | null;
  },
  now = new Date()
): Promise<number | null> {
  const rules = await loadActiveFlashSaleRules(now);
  if (rules.length === 0) return null;
  const catalogUnit = Number(product.discounted_price ?? product.base_price);
  const ctx: FlashProductContext = {
    id: product.id,
    category_id: product.category_id,
    brand_id: product.brand_id,
    catalog_unit: catalogUnit,
  };
  const isLive = (rule: FlashSaleRule) =>
    isActiveInWindow(rule.is_active, rule.active_from, rule.active_until, now);
  return bestFlashUnitPrice(ctx, rules, isLive);
}
