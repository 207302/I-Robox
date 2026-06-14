import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { compactOrderId } from "@/lib/orders/orderNumber";
import { adminProductImageSelect, firstProductImageUrl } from "@/lib/admin/productThumbnail";
import { AdminOrdersTable, type AdminOrderRow } from "@/components/admin/AdminOrdersTable";

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

  const orders = await prisma.orders.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      order_number: true,
      status: true,
      payment_status: true,
      total_amount: true,
      created_at: true,
      customer_id: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: { select: { full_name: true } },
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
      paymentStatus: String(o.payment_status),
      totalAmount: Number(o.total_amount),
      createdAtLabel: formatDateTimeIst(o.created_at),
      customerName:
        o.addresses_orders_shipping_address_idToaddresses?.full_name?.trim() ||
        o.customers?.name?.trim() ||
        null,
      customerEmail: o.customers?.email ?? null,
      productNames: o.order_items.map((item) => item.product_name).join(" "),
      products: [...productMap.values()],
    };
  });

  return (
    <div className="space-y-6">
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

      <AdminOrdersTable orders={rows} canDelete={canDeleteOrders} />
    </div>
  );
}
