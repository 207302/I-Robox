import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FLASH_SALES_TAG } from "@/lib/cache/tags";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  bestFlashSaleMatch,
  bestFlashUnitPrice,
  flashSaleClaimTag,
  resolveFlashSaleClaimRule,
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
  name?: string | null;
  purchase_limit?: number;
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
    name: row.name ?? null,
    purchase_limit: Math.max(0, Math.trunc(row.purchase_limit ?? 0)),
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

type CachedFlashSaleRule = Omit<FlashSaleRule, "active_from" | "active_until"> & {
  active_from: string | null;
  active_until: string | null;
};

async function queryActiveFlashSaleRuleRows(): Promise<CachedFlashSaleRule[]> {
  const rows = await prisma.flash_sales.findMany({
    where: { is_active: true },
    include: flashSaleInclude,
    orderBy: { updated_at: "desc" },
  });
  return rows.map((row) => {
    const mapped = mapFlashSaleRow(row);
    return {
      ...mapped,
      active_from: mapped.active_from ? mapped.active_from.toISOString() : null,
      active_until: mapped.active_until ? mapped.active_until.toISOString() : null,
    };
  });
}

const getCachedActiveFlashSaleRuleRows = unstable_cache(
  queryActiveFlashSaleRuleRows,
  ["active-flash-sale-rules"],
  { revalidate: 60, tags: [FLASH_SALES_TAG] }
);

export type FlashSaleRuleLoadOptions = {
  /** Read straight from the database. Required wherever money or purchase limits are enforced. */
  fresh?: boolean;
};

export async function loadActiveFlashSaleRules(
  now = new Date(),
  options: FlashSaleRuleLoadOptions = {}
): Promise<FlashSaleRule[]> {
  const rows = options.fresh
    ? await queryActiveFlashSaleRuleRows()
    : await getCachedActiveFlashSaleRuleRows();
  return rows
    .map((rule) => ({
      ...rule,
      active_from: rule.active_from ? new Date(rule.active_from) : null,
      active_until: rule.active_until ? new Date(rule.active_until) : null,
    }))
    .filter((rule) => isActiveInWindow(rule.is_active, rule.active_from, rule.active_until, now));
}

export type FlashSaleProductInfo = {
  unitPrice: number;
  /** Present when this sale has a per-customer purchase limit. */
  saleTag: string | null;
  /** Max units per customer; 0 = unlimited. */
  purchaseLimit: number;
  flashSaleId: string;
};

/** Product id → winning flash sale price + claim tag. */
export async function flashSaleInfoMap(
  productIds: string[],
  options: FlashSaleRuleLoadOptions = {}
): Promise<Map<string, FlashSaleProductInfo>> {
  const map = new Map<string, FlashSaleProductInfo>();
  if (productIds.length === 0) return map;

  const now = new Date();
  const rules = await loadActiveFlashSaleRules(now, options);
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
    const priceMatch = bestFlashSaleMatch(ctx, rules, isLive);
    const claimRule = resolveFlashSaleClaimRule(ctx, rules, isLive);
    if (!priceMatch && !claimRule) continue;
    map.set(product.id, {
      unitPrice: priceMatch?.unitPrice ?? catalogUnit,
      saleTag: claimRule ? flashSaleClaimTag(claimRule) : null,
      purchaseLimit: claimRule?.purchase_limit ?? 0,
      flashSaleId: (claimRule ?? priceMatch!.rule).id,
    });
  }

  return map;
}

/** Product id → flash sale unit price (lowest matching active rule). */
export async function flashSalePriceMap(
  productIds: string[],
  options: FlashSaleRuleLoadOptions = {}
): Promise<Map<string, number>> {
  const info = await flashSaleInfoMap(productIds, options);
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
): Promise<{
  unitPrice: number;
  saleTag: string | null;
  purchaseLimit: number;
  flashSaleId: string;
} | null> {
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
  const priceMatch = bestFlashSaleMatch(ctx, rules, isLive);
  const claimRule = resolveFlashSaleClaimRule(ctx, rules, isLive);
  if (!priceMatch && !claimRule) return null;
  return {
    unitPrice: priceMatch?.unitPrice ?? catalogUnit,
    saleTag: claimRule ? flashSaleClaimTag(claimRule) : null,
    purchaseLimit: claimRule?.purchase_limit ?? 0,
    flashSaleId: (claimRule ?? priceMatch!.rule).id,
  };
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
