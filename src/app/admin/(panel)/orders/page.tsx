import { getAdminSession } from "@/lib/auth/session";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import Link from "next/link";

export const metadata = {
  title: "Admin Orders | i-Robox",
};

export default async function AdminOrdersPage() {
  const session = await getAdminSession();
  const canDeleteOrders = (session?.roles ?? []).includes("SUPER_ADMIN");
  const canCreateOrder = canDeleteOrders;

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

      <AdminOrdersTable canDelete={canDeleteOrders} canCreateOrder={canCreateOrder} />
    </div>
  );
}
