/** Cart subtotal before discount — free shipping when at or above this (if threshold is enabled). */
export const DEFAULT_FREE_SHIPPING_THRESHOLD_INR = 2000;

export type OrderShippingLine = {
  quantity: number;
  shippingPerUnit: number;
  lineSubtotal: number;
  categoryId?: string | null;
};

/**
 * DB/admin value → threshold used at checkout.
 * - null/undefined in DB → default ₹2000
 * - 0 → free shipping disabled
 * - positive → that minimum subtotal
 */
export function resolveFreeShippingThresholdInr(
  stored: number | string | null | undefined
): number | null {
  if (stored === undefined || stored === null) {
    return DEFAULT_FREE_SHIPPING_THRESHOLD_INR;
  }
  const n = Number(stored);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_FREE_SHIPPING_THRESHOLD_INR;
  if (n === 0) return null;
  return Math.round(n * 100) / 100;
}

export function orderShippingInrFromLines(args: {
  /** Pre-discount subtotal (same rule as existing checkout). */
  subtotalBeforeDiscount: number;
  lines: OrderShippingLine[];
  /** When null, free shipping is off. When set, shipping is ₹0 at or above this subtotal. */
  freeShippingThresholdInr?: number | null;
  /** Category IDs omitted from threshold subtotal; these lines always pay per-unit shipping. */
  freeShippingExcludedCategoryIds?: string[];
}): number {
  const excluded = new Set(args.freeShippingExcludedCategoryIds ?? []);
  const threshold = args.freeShippingThresholdInr;

  const eligibleSubtotal = args.lines.reduce((sum, line) => {
    if (line.categoryId && excluded.has(line.categoryId)) return sum;
    return sum + line.lineSubtotal;
  }, 0);

  const qualifiesForFreeShipping =
    threshold != null && eligibleSubtotal >= threshold;

  let shipping = 0;
  for (const line of args.lines) {
    const isExcluded = Boolean(line.categoryId && excluded.has(line.categoryId));
    if (isExcluded || !qualifiesForFreeShipping) {
      shipping += line.quantity * Math.max(0, line.shippingPerUnit);
    }
  }

  return Math.round(shipping * 100) / 100;
}
