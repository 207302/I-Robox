export const SHIPMOZO_TRACKING_STEPS = [
  "ORDER_PLACED",
  "PICKUP_GENERATED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type ShipmozoTrackingStatus = (typeof SHIPMOZO_TRACKING_STEPS)[number];

export const SHIPMOZO_TRACKING_STEP_LABELS: Record<ShipmozoTrackingStatus, string> = {
  ORDER_PLACED: "Order Placed",
  PICKUP_GENERATED: "Pickup Generated",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
};

export function isShipmozoTrackingStatus(value: string): value is ShipmozoTrackingStatus {
  return SHIPMOZO_TRACKING_STEPS.includes(value as ShipmozoTrackingStatus);
}

export function formatShipmozoTrackingLabel(status: ShipmozoTrackingStatus): string {
  return SHIPMOZO_TRACKING_STEP_LABELS[status];
}
