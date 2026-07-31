import type { PurchaseAnalyticsItem, PurchaseAnalyticsPayload } from "@/lib/analytics/trackPurchase";

type LineLike = {
  productId: string;
  productName?: string;
  name?: string;
  unitPrice?: number;
  price?: number;
  quantity: number;
  subtotal?: number;
};

/** Server → client payload so GA4 gets the real order total after discounts/shipping. */
export function buildPurchaseAnalyticsPayload(input: {
  transactionId: string;
  value: number;
  currency?: string;
  shipping?: number;
  tax?: number;
  coupon?: string | null;
  lineItems: LineLike[];
}): PurchaseAnalyticsPayload {
  const items: PurchaseAnalyticsItem[] = input.lineItems.map((li) => {
    const quantity = Math.max(1, Math.floor(Number(li.quantity) || 1));
    const price =
      li.unitPrice != null
        ? Number(li.unitPrice)
        : li.price != null
          ? Number(li.price)
          : li.subtotal != null
            ? Number(li.subtotal) / quantity
            : 0;
    return {
      item_id: String(li.productId),
      item_name: String(li.productName || li.name || "Product"),
      price: Number.isFinite(price) ? price : 0,
      quantity,
    };
  });

  return {
    transaction_id: String(input.transactionId),
    value: Number(input.value) || 0,
    currency: input.currency || "INR",
    ...(input.shipping != null ? { shipping: Number(input.shipping) || 0 } : {}),
    ...(input.tax != null ? { tax: Number(input.tax) || 0 } : {}),
    ...(input.coupon ? { coupon: input.coupon } : {}),
    items,
  };
}
