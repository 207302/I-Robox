import type { ShipmentStatus } from "@/lib/shipping/shipmozoTrackingConstants";

export const ADMIN_ORDERS_PAGE_SIZE = 50;
export const ADMIN_ORDERS_MAX_PAGE_SIZE = 100;

export type AdminOrderProductThumb = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  orderId: string;
  status: string;
  shipmentStatus: ShipmentStatus | null;
  paymentStatus: string;
  totalAmount: number;
  createdAtLabel: string;
  customerName: string | null;
  customerEmail: string | null;
  razorpayPaymentId: string | null;
  refundTransactionId: string | null;
  productNames: string;
  products: AdminOrderProductThumb[];
  shipmozoError: string | null;
  paymentLinkUrl: string | null;
  paymentLinkPending: boolean;
};
