import { bookShipmozoShipmentForOrder, type ShipmozoBookingResult } from "@/lib/shipping/shipmozo";

export async function bookShipmentForOrder(
  orderId: string,
  options?: { force?: boolean }
): Promise<ShipmozoBookingResult> {
  return bookShipmozoShipmentForOrder(orderId, options);
}
