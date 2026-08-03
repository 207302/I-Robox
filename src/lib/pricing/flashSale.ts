import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  bestFlashSaleMatch,
  bestFlashUnitPrice,
  flashSaleClaimTag,
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
  sale_tag?: string | null;
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
    sale_tag: row.sale_tag?.trim() ? row.sale_tag.trim() : null,
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

export type FlashSaleProductInfo = {
  unitPrice: number;
  saleTag: string;
  flashSaleId: string;
};

/** Product id → winning flash sale price + claim tag. */
export async function flashSaleInfoMap(
  productIds: string[]
): Promise<Map<string, FlashSaleProductInfo>> {
  const map = new Map<string, FlashSaleProductInfo>();
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
    const match = bestFlashSaleMatch(ctx, rules, isLive);
    if (match) {
      map.set(product.id, {
        unitPrice: match.unitPrice,
        saleTag: flashSaleClaimTag(match.rule),
        flashSaleId: match.rule.id,
      });
    }
  }

  return map;
}

/** Product id → flash sale unit price (lowest matching active rule). */
export async function flashSalePriceMap(productIds: string[]): Promise<Map<string, number>> {
  const info = await flashSaleInfoMap(productIds);
  const map = new Map<string, number>();
  for (const [id, row] of info) map.set(id, row.unitPrice);
  return map;
}

export async function flashSaleUnitPriceAndTagForProduct(
  product: {
    id: string;
    category_id: string | null;
    brand_id: string | null;
    base_price: { toString(): string } | number;
    discounted_price: { toString(): string } | number | null;
  },
  now = new Date()
): Promise<{ unitPrice: number; saleTag: string } | null> {
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
  const match = bestFlashSaleMatch(ctx, rules, isLive);
  if (!match) return null;
  return { unitPrice: match.unitPrice, saleTag: flashSaleClaimTag(match.rule) };
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
