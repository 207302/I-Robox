export const FLASH_DISCOUNT_TYPES = ["FIXED", "PERCENTAGE"] as const;
export type FlashDiscountType = (typeof FLASH_DISCOUNT_TYPES)[number];

export type FlashSaleRule = {
  id: string;
  /** Optional shared claim key; when null/empty, claims use `id`. */
  sale_tag: string | null;
  discount_type: FlashDiscountType;
  discount_value: number;
  is_active: boolean;
  active_from: Date | null;
  active_until: Date | null;
  product_ids: string[];
  category_ids: string[];
  brand_ids: string[];
};

/** Claim identity for one-purchase-per-customer enforcement. */
export function flashSaleClaimTag(rule: Pick<FlashSaleRule, "id" | "sale_tag">): string {
  const tag = (rule.sale_tag ?? "").trim();
  return tag || rule.id;
}

export type FlashProductContext = {
  id: string;
  category_id: string | null;
  brand_id: string | null;
  catalog_unit: number;
};

export function isFlashDiscountType(value: string): value is FlashDiscountType {
  return FLASH_DISCOUNT_TYPES.includes(value as FlashDiscountType);
}

export function flashSaleHasScope(rule: Pick<FlashSaleRule, "product_ids" | "category_ids" | "brand_ids">): boolean {
  return rule.product_ids.length > 0 || rule.category_ids.length > 0 || rule.brand_ids.length > 0;
}

export function productMatchesFlashSale(
  product: Pick<FlashProductContext, "id" | "category_id" | "brand_id">,
  rule: Pick<FlashSaleRule, "product_ids" | "category_ids" | "brand_ids">
): boolean {
  if (rule.product_ids.includes(product.id)) return true;
  if (product.category_id && rule.category_ids.includes(product.category_id)) return true;
  if (product.brand_id && rule.brand_ids.includes(product.brand_id)) return true;
  return false;
}

export function computeFlashUnitPrice(
  catalogUnit: number,
  discount_type: FlashDiscountType,
  discount_value: number
): number {
  if (discount_type === "FIXED") return discount_value;
  const pct = Math.min(100, Math.max(0, discount_value));
  return Math.max(0, catalogUnit * (1 - pct / 100));
}

export function bestFlashSaleMatch(
  product: FlashProductContext,
  rules: FlashSaleRule[],
  isLive: (rule: FlashSaleRule) => boolean
): { unitPrice: number; rule: FlashSaleRule } | null {
  let best: { unitPrice: number; rule: FlashSaleRule } | null = null;
  for (const rule of rules) {
    if (!isLive(rule) || !productMatchesFlashSale(product, rule)) continue;
    const candidate = computeFlashUnitPrice(
      product.catalog_unit,
      rule.discount_type,
      rule.discount_value
    );
    if (!(candidate < product.catalog_unit)) continue;
    if (best === null || candidate < best.unitPrice) {
      best = { unitPrice: candidate, rule };
    }
  }
  return best;
}

export function bestFlashUnitPrice(
  product: FlashProductContext,
  rules: FlashSaleRule[],
  isLive: (rule: FlashSaleRule) => boolean
): number | null {
  return bestFlashSaleMatch(product, rules, isLive)?.unitPrice ?? null;
}

export function formatFlashDiscount(
  discount_type: FlashDiscountType,
  discount_value: number
): string {
  if (discount_type === "PERCENTAGE") return `${discount_value}% off`;
  return `₹${discount_value}`;
}
