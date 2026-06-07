import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD_INR,
  resolveFreeShippingThresholdInr,
} from "@/lib/checkout/orderShipping";
import { getSiteMarketingSettings } from "@/lib/queries/marketing";

/** Resolved threshold for comparisons: number = min subtotal for free shipping; null = disabled. */
export const getFreeShippingThresholdInr = cache(async function getFreeShippingThresholdInr(): Promise<
  number | null
> {
  const row = await getSiteMarketingSettings().catch(() => null);

  return resolveFreeShippingThresholdInr(
    row?.free_shipping_threshold_inr != null ? Number(row.free_shipping_threshold_inr) : null
  );
});

/** Categories excluded from free-shipping threshold subtotal. */
export const getFreeShippingExcludedCategoryIds = cache(
  async function getFreeShippingExcludedCategoryIds(): Promise<string[]> {
    try {
      const rows = await prisma.free_shipping_excluded_categories.findMany({
        select: { category_id: true },
      });
      return rows.map((row) => row.category_id);
    } catch {
      return [];
    }
  }
);

/** Display value for admin/header (default when DB unset). */
export function formatFreeShippingThresholdLabel(threshold: number | null): string {
  if (threshold == null) return "disabled";
  return String(threshold);
}

export { DEFAULT_FREE_SHIPPING_THRESHOLD_INR };
