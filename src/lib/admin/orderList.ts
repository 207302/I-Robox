import { order_status_type, payment_status_type, Prisma } from "@prisma/client";
import { compactOrderId } from "@/lib/orders/orderNumber";
import { adminProductImageSelect, firstProductImageUrl } from "@/lib/admin/productThumbnail";
import {
  ADMIN_ORDERS_MAX_PAGE_SIZE,
  ADMIN_ORDERS_PAGE_SIZE,
  type AdminOrderProductThumb,
  type AdminOrderRow,
} from "@/lib/admin/orderListTypes";
import { prisma } from "@/lib/prisma";
import { shipmozoFailureSummary } from "@/lib/shipping/shipmozoAdminError";
import type { ShipmentStatus } from "@/lib/shipping/shipmozoTrackingConstants";

export {
  ADMIN_ORDERS_MAX_PAGE_SIZE,
  ADMIN_ORDERS_PAGE_SIZE,
  type AdminOrderProductThumb,
  type AdminOrderRow,
} from "@/lib/admin/orderListTypes";

export const adminOrderListSelect = {
  id: true,
  order_number: true,
  status: true,
  shipment_status: true,
  payment_status: true,
  payment_provider: true,
  external_payment_id: true,
  refund_transaction_id: true,
  total_amount: true,
  created_at: true,
  customer_id: true,
  customers: { select: { email: true, name: true } },
  addresses_orders_shipping_address_idToaddresses: { select: { full_name: true } },
  razorpay_payment_link_url: true,
  razorpay_payment_link_expires_at: true,
  created_by_admin_id: true,
  shipments: { select: { metadata: true } },
  order_items: {
    select: {
      product_id: true,
      product_name: true,
      quantity: true,
      products: {
        select: {
          slug: true,
          product_images: adminProductImageSelect,
        },
      },
    },
  },
} satisfies Prisma.ordersSelect;

export type AdminOrderListRecord = Prisma.ordersGetPayload<{ select: typeof adminOrderListSelect }>;

function formatDateTimeIst(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mapOrderToAdminRow(o: AdminOrderListRecord): AdminOrderRow {
  const productMap = new Map<string, AdminOrderProductThumb>();

  for (const item of o.order_items) {
    const slug = item.products?.slug?.trim() ?? "";
    if (!slug) continue;
    const existing = productMap.get(item.product_id);
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }
    productMap.set(item.product_id, {
      productId: item.product_id,
      slug,
      name: item.product_name,
      imageUrl: item.products ? firstProductImageUrl(item.products) : null,
      quantity: item.quantity,
    });
  }

  return {
    id: o.id,
    orderNumber: o.order_number,
    orderId: compactOrderId(o.order_number),
    status: String(o.status),
    shipmentStatus: (o.shipment_status as ShipmentStatus | null) ?? null,
    paymentStatus: String(o.payment_status),
    totalAmount: Number(o.total_amount),
    createdAtLabel: formatDateTimeIst(o.created_at),
    customerName:
      o.addresses_orders_shipping_address_idToaddresses?.full_name?.trim() ||
      o.customers?.name?.trim() ||
      null,
    customerEmail: o.customers?.email ?? null,
    razorpayPaymentId:
      o.payment_provider === "razorpay" && o.external_payment_id
        ? o.external_payment_id
        : null,
    refundTransactionId: o.refund_transaction_id ?? null,
    productNames: o.order_items.map((item) => item.product_name).join(" "),
    products: [...productMap.values()],
    shipmozoError: shipmozoFailureSummary(o.shipments?.metadata),
    paymentLinkUrl: o.razorpay_payment_link_url,
    paymentLinkPending: String(o.payment_status) === "PENDING" && Boolean(o.created_by_admin_id),
  };
}

export function buildAdminOrderSearchWhere(q: string): Prisma.ordersWhereInput | undefined {
  const query = q.trim();
  if (!query) return undefined;

  const lowered = query.toLowerCase();
  const digits = query.replace(/\D/g, "");
  const or: Prisma.ordersWhereInput[] = [
    { order_number: { contains: query, mode: "insensitive" } },
    { shipment_status: { contains: query, mode: "insensitive" } },
    { external_payment_id: { contains: query, mode: "insensitive" } },
    { refund_transaction_id: { contains: query, mode: "insensitive" } },
    { customers: { is: { email: { contains: query, mode: "insensitive" } } } },
    { customers: { is: { name: { contains: query, mode: "insensitive" } } } },
    {
      addresses_orders_shipping_address_idToaddresses: {
        is: { full_name: { contains: query, mode: "insensitive" } },
      },
    },
    { order_items: { some: { product_name: { contains: query, mode: "insensitive" } } } },
  ];

  if (digits.length >= 4) {
    or.push({ order_number: { contains: digits } });
  }

  if (UUID_RE.test(query)) {
    or.push({ id: query });
  }

  for (const status of Object.values(order_status_type)) {
    if (status.toLowerCase().includes(lowered) || lowered.includes(status.toLowerCase())) {
      or.push({ status });
    }
  }
  for (const payment of Object.values(payment_status_type)) {
    if (payment.toLowerCase().includes(lowered) || lowered.includes(payment.toLowerCase())) {
      or.push({ payment_status: payment });
    }
  }

  return { OR: or };
}

export async function listAdminOrders(input: {
  page: number;
  limit: number;
  q: string;
}): Promise<{
  orders: AdminOrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const limit = Math.min(
    ADMIN_ORDERS_MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(input.limit) || ADMIN_ORDERS_PAGE_SIZE)
  );
  const requestedPage = Math.max(1, Math.trunc(input.page) || 1);
  const where = buildAdminOrderSearchWhere(input.q);

  const total = await prisma.orders.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * limit;

  const rows = await prisma.orders.findMany({
    where,
    orderBy: { created_at: "desc" },
    skip,
    take: limit,
    select: adminOrderListSelect,
  });

  return {
    orders: rows.map(mapOrderToAdminRow),
    total,
    page,
    limit,
    totalPages,
  };
}
