import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { compactOrderId } from "@/lib/orders/orderNumber";
import { adminProductImageSelect, firstProductImageUrl } from "@/lib/admin/productThumbnail";
import { AdminOrdersTable, type AdminOrderRow } from "@/components/admin/AdminOrdersTable";
import type { ShipmentStatus } from "@/lib/shipping/shipmozoTrackingConstants";
import { shipmozoFailureSummary } from "@/lib/shipping/shipmozoAdminError";
import Link from "next/link";

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

export const metadata = {
  title: "Admin Orders | i-Robox",
};

export default async function AdminOrdersPage() {
  const session = await getAdminSession();
  const canDeleteOrders = (session?.roles ?? []).includes("SUPER_ADMIN");
  const canCreateOrder = canDeleteOrders;

  const orders = await prisma.orders.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
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
    },
  });

  const rows: AdminOrderRow[] = orders.map((o) => {
    const productMap = new Map<
      string,
      { productId: string; slug: string; name: string; imageUrl: string | null; quantity: number }
    >();

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
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark">Orders</h1>
          {canDeleteOrders ? (
            <p className="mt-2 text-sm text-meta-3 max-w-2xl">
              Deleting an order is permanent (Super Admin only). Reserved or sold stock is returned to
              available quantity where possible. Use for test orders or cleanup — not a substitute for refunds
              on real customer orders.
            </p>
          ) : null}
        </div>
        {canCreateOrder ? (
          <Link
            href="/admin/orders/new"
            className="inline-flex shrink-0 items-center rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Create Order
          </Link>
        ) : null}
      </div>

      <AdminOrdersTable orders={rows} canDelete={canDeleteOrders} canCreateOrder={canCreateOrder} />
    </div>
  );
}
