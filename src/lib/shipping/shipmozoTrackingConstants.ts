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

export const SHIPMOZO_NOT_DELIVERED_STATUS = "NOT_DELIVERED" as const;

export type ShipmentStatus = ShipmozoTrackingStatus | typeof SHIPMOZO_NOT_DELIVERED_STATUS;

/** Re-poll ND orders after this window in case ShipMozo reports re-delivery as DELIVERED. */
export const SHIPMOZO_NOT_DELIVERED_REPOLL_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isShipmozoNotDeliveredStatus(raw: string): boolean {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (
    key === "ND" ||
    key === "NOT_DELIVERED" ||
    key === "UNDELIVERED" ||
    // ShipMozo uses NDR for final non-delivery; if ShipMozo later sends DELIVERED after NDR,
    // the normal status flow will override. Confirm with ShipMozo docs/support whether NDR is final or retriable.
    key === "NDR" ||
    key === "NON_DELIVERY" ||
    key === "NOTDELIVERED"
  );
}

export function isShipmozoTrackingStatus(value: string): value is ShipmozoTrackingStatus {
  return SHIPMOZO_TRACKING_STEPS.includes(value as ShipmozoTrackingStatus);
}

export function formatShipmozoTrackingLabel(status: ShipmozoTrackingStatus): string {
  return SHIPMOZO_TRACKING_STEP_LABELS[status];
}
