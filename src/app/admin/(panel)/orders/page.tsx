import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { compactOrderId } from "@/lib/orders/orderNumber";
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
      customers: { select: { email: true } },
    },
  });

  const rows: AdminOrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    orderId: compactOrderId(o.order_number),
    status: String(o.status),
    paymentStatus: String(o.payment_status),
    totalAmount: Number(o.total_amount),
    createdAtLabel: formatDateTimeIst(o.created_at),
    customerEmail: o.customers?.email ?? null,
  }));

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
