/** Cart subtotal before discount — free shipping when at or above this (if threshold is enabled). */
export const DEFAULT_FREE_SHIPPING_THRESHOLD_INR = 2000;

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
  lines: { quantity: number; shippingPerUnit: number }[];
  /** When null, free shipping is off. When set, shipping is ₹0 at or above this subtotal. */
  freeShippingThresholdInr?: number | null;
}): number {
  const threshold = args.freeShippingThresholdInr;
  if (threshold != null && args.subtotalBeforeDiscount >= threshold) return 0;

  const raw = args.lines.reduce((s, li) => s + li.quantity * Math.max(0, li.shippingPerUnit), 0);
  return Math.round(raw * 100) / 100;
}
