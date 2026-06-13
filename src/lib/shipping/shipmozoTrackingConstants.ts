export const SHIPMOZO_TRACKING_STEPS = [
  "ORDER_PLACED",
  "PICKUP_GENERATED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type ShipmozoTrackingStatus = (typeof SHIPMOZO_TRACKING_STEPS)[number];
