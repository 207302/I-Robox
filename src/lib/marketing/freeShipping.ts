import { cache } from "react";
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

/** Display value for admin/header (default when DB unset). */
export function formatFreeShippingThresholdLabel(threshold: number | null): string {
  if (threshold == null) return "disabled";
  return String(threshold);
}

export { DEFAULT_FREE_SHIPPING_THRESHOLD_INR };
