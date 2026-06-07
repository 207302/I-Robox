export type MarketingPopupPayload = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  delay_ms: number;
  auto_close_ms: number;
  frequency: string;
  suggested_coupon_code: string | null;
};

export type PublicMarketingPayload = {
  popup: MarketingPopupPayload | null;
  firstVisitCouponCode: string | null;
  freeShippingThresholdInr: number | null;
  freeShippingExcludedBrandIds: string[];
};
