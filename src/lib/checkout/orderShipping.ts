/** Cart subtotal before discount — free shipping when at or above this (if threshold is enabled). */
export const DEFAULT_FREE_SHIPPING_THRESHOLD_INR = 2000;
/** Per-unit fallback when a product's shipping_per_unit is 0 (admin copy references ₹99). */
export const DEFAULT_FLAT_SHIPPING_PER_UNIT_INR = 99;

export type OrderShippingLine = {
  productId?: string;
  quantity: number;
  shippingPerUnit: number;
  lineSubtotal: number;
  brandId?: string | null;
};

export type OrderShippingContribution = {
  productId?: string;
  quantity: number;
  unitRateInr: number;
  lineShippingInr: number;
  isExcluded: boolean;
};

export type OrderShippingBreakdown = {
  totalInr: number;
  chargeableUnits: number;
  contributions: OrderShippingContribution[];
};

export function orderShippingBreakdownFromLines(args: {
  subtotalBeforeDiscount: number;
  lines: OrderShippingLine[];
  freeShippingThresholdInr?: number | null;
  freeShippingExcludedBrandIds?: string[];
}): OrderShippingBreakdown {
  const excluded = new Set(args.freeShippingExcludedBrandIds ?? []);
  const threshold = args.freeShippingThresholdInr;

  const eligibleSubtotal = args.lines.reduce((sum, line) => {
    if (line.brandId && excluded.has(line.brandId)) return sum;
    return sum + line.lineSubtotal;
  }, 0);

  const qualifiesForFreeShipping =
    threshold != null && eligibleSubtotal >= threshold;

  const contributions: OrderShippingContribution[] = [];
  let totalInr = 0;
  let chargeableUnits = 0;

  for (const line of args.lines) {
    const isExcluded = Boolean(line.brandId && excluded.has(line.brandId));
    const rate = Math.max(0, Number(line.shippingPerUnit ?? 0));
    const hasExplicitRate = rate > 0;
    /** Explicit per-product shipping always stacks; zero-rate lines follow threshold / exclusion rules. */
    const chargeShipping = isExcluded || hasExplicitRate || !qualifiesForFreeShipping;
    if (!chargeShipping || line.quantity <= 0) continue;

    const unitRateInr = hasExplicitRate ? rate : DEFAULT_FLAT_SHIPPING_PER_UNIT_INR;
    const lineShippingInr = line.quantity * unitRateInr;
    totalInr += lineShippingInr;
    chargeableUnits += line.quantity;
    contributions.push({
      productId: line.productId,
      quantity: line.quantity,
      unitRateInr,
      lineShippingInr,
      isExcluded,
    });
  }

  return {
    totalInr: Math.round(totalInr * 100) / 100,
    chargeableUnits,
    contributions,
  };
}

export function shippingInrForLine(
  line: Pick<OrderShippingLine, "quantity" | "shippingPerUnit">,
  chargeShipping: boolean
): number {
  if (!chargeShipping || line.quantity <= 0) return 0;
  const rate = Math.max(0, Number(line.shippingPerUnit ?? 0));
  const unitRate = rate > 0 ? rate : DEFAULT_FLAT_SHIPPING_PER_UNIT_INR;
  return line.quantity * unitRate;
}

/** Whether this line pays shipping (used when callers evaluate charge per line). */
export function shouldChargeShippingForLine(
  line: Pick<OrderShippingLine, "shippingPerUnit" | "brandId">,
  args: {
    qualifiesForFreeShipping: boolean;
    freeShippingExcludedBrandIds?: string[];
  }
): boolean {
  const excluded = new Set(args.freeShippingExcludedBrandIds ?? []);
  const isExcluded = Boolean(line.brandId && excluded.has(line.brandId));
  const hasExplicitRate = Math.max(0, Number(line.shippingPerUnit ?? 0)) > 0;
  return isExcluded || hasExplicitRate || !args.qualifiesForFreeShipping;
}

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
  /** Brand IDs omitted from threshold subtotal; these lines always pay per-unit shipping. */
  freeShippingExcludedBrandIds?: string[];
}): number {
  return orderShippingBreakdownFromLines(args).totalInr;
}
