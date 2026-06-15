/** Extra grams for outer box / padding when combining line items. */
export const PACKAGE_PADDING_G = 50;

/** Used when a product has no weight filled in yet. */
export const FALLBACK_ITEM_WEIGHT_G = 300;

export type PackageLineInput = {
  quantity: number;
  weightG: number | null | undefined;
};

export type OrderPackageDetails = {
  weightG: number;
  /** True if any line used fallback weight. */
  usedFallback: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Sum packed weight across order lines (qty × weight) + padding. */
export function computeOrderPackageDetails(lines: PackageLineInput[]): OrderPackageDetails {
  if (lines.length === 0) {
    return {
      weightG: FALLBACK_ITEM_WEIGHT_G + PACKAGE_PADDING_G,
      usedFallback: true,
    };
  }

  let totalWeightG = PACKAGE_PADDING_G;
  let usedFallback = false;

  for (const line of lines) {
    const qty = Math.max(1, Math.floor(line.quantity) || 1);
    let weightG = line.weightG != null ? Number(line.weightG) : NaN;
    if (!Number.isFinite(weightG) || weightG <= 0) {
      weightG = FALLBACK_ITEM_WEIGHT_G;
      usedFallback = true;
    }
    totalWeightG += weightG * qty;
  }

  return {
    weightG: clamp(Math.round(totalWeightG), 1, 30_000),
    usedFallback,
  };
}
