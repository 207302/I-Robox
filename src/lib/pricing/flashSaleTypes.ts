export const FLASH_DISCOUNT_TYPES = ["FIXED", "PERCENTAGE"] as const;
export type FlashDiscountType = (typeof FLASH_DISCOUNT_TYPES)[number];

export type FlashSaleRule = {
  id: string;
  /** Max units per customer for this sale. 0 = unlimited. */
  purchase_limit: number;
  discount_type: FlashDiscountType;
  discount_value: number;
  is_active: boolean;
  active_from: Date | null;
  active_until: Date | null;
  product_ids: string[];
  category_ids: string[];
  brand_ids: string[];
};

/** Claim identity for per-customer purchase-limit enforcement (flash sale id). */
export function flashSaleClaimTag(rule: Pick<FlashSaleRule, "id">): string {
  return rule.id;
}

export function flashSaleIsLimited(purchaseLimit: number): boolean {
  return purchaseLimit > 0;
}

/** Claim tag when the sale has a per-customer limit; otherwise null. */
export function flashSaleClaimTagIfLimited(
  rule: Pick<FlashSaleRule, "id" | "purchase_limit">
): string | null {
  if (!flashSaleIsLimited(rule.purchase_limit)) return null;
  return flashSaleClaimTag(rule);
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

/**
 * Limited flash sale for per-customer claim/quota.
 * Matches by scope even when the flash price does not beat catalog
 * (e.g. ₹1 test products with a FIXED ₹1 sale price).
 */
export function bestLimitedFlashSaleMatch(
  product: Pick<FlashProductContext, "id" | "category_id" | "brand_id"> & {
    catalog_unit?: number;
  },
  rules: FlashSaleRule[],
  isLive: (rule: FlashSaleRule) => boolean
): FlashSaleRule | null {
  let best: FlashSaleRule | null = null;
  let bestPrice = Infinity;
  const catalogUnit = product.catalog_unit ?? 0;
  for (const rule of rules) {
    if (!isLive(rule) || !flashSaleIsLimited(rule.purchase_limit)) continue;
    if (!productMatchesFlashSale(product, rule)) continue;
    const candidate = computeFlashUnitPrice(
      catalogUnit,
      rule.discount_type,
      rule.discount_value
    );
    if (
      best === null ||
      candidate < bestPrice ||
      (candidate === bestPrice && rule.purchase_limit < best.purchase_limit)
    ) {
      best = rule;
      bestPrice = candidate;
    }
  }
  return best;
}

/** Prefer the price-winning limited rule; otherwise any matching limited sale. */
export function resolveFlashSaleClaimRule(
  product: FlashProductContext,
  rules: FlashSaleRule[],
  isLive: (rule: FlashSaleRule) => boolean
): FlashSaleRule | null {
  const priceMatch = bestFlashSaleMatch(product, rules, isLive);
  if (priceMatch && flashSaleIsLimited(priceMatch.rule.purchase_limit)) {
    return priceMatch.rule;
  }
  return bestLimitedFlashSaleMatch(product, rules, isLive);
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
