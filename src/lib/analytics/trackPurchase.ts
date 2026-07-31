/**
 * Push a GA4/GTM ecommerce `purchase` event after a successful order.
 * Without this, GA4 `purchaseRevenue` / `transactions` stay empty even when
 * the store database has paid orders.
 */

export type PurchaseAnalyticsItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

export type PurchaseAnalyticsPayload = {
  transaction_id: string;
  value: number;
  currency?: string;
  shipping?: number;
  tax?: number;
  coupon?: string;
  items: PurchaseAnalyticsItem[];
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPurchase(payload: PurchaseAnalyticsPayload): void {
  if (typeof window === "undefined") return;

  const currency = payload.currency?.trim() || "INR";
  const value = Number(payload.value);
  if (!payload.transaction_id || !Number.isFinite(value) || value < 0) return;

  const ecommerce = {
    transaction_id: payload.transaction_id,
    value,
    currency,
    ...(payload.shipping != null ? { shipping: Number(payload.shipping) || 0 } : {}),
    ...(payload.tax != null ? { tax: Number(payload.tax) || 0 } : {}),
    ...(payload.coupon ? { coupon: payload.coupon } : {}),
    items: payload.items.map((item) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      price: Number(item.price) || 0,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    })),
  };

  try {
    window.dataLayer = window.dataLayer || [];
    // Clear previous ecommerce object so GTM does not merge stale items.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: "purchase",
      ecommerce,
    });
  } catch (err) {
    console.error("[analytics] dataLayer purchase push failed", err);
  }

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", "purchase", ecommerce);
    }
  } catch (err) {
    console.error("[analytics] gtag purchase failed", err);
  }
}
