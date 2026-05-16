import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/utils/formatePrice";
import Link from "next/link";

export const metadata = {
  title: "Admin Dashboard | i-Robox",
};

export default async function AdminDashboard() {
  const [orderCount, revenueAgg, pendingOrders, inventoryRows] = await Promise.all([
    prisma.orders.count(),
    prisma.orders.aggregate({
      _sum: { total_amount: true },
      where: { payment_status: "SUCCEEDED" },
    }),
    prisma.orders.count({ where: { status: "PENDING" } }),
    // Count rows where available <= threshold using raw comparison
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM inventory
      WHERE available_quantity <= low_stock_threshold
    `,
  ]);

  const lowStock = Number(inventoryRows[0]?.count ?? 0);

  const revenue = Number(revenueAgg._sum.total_amount ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-3 bg-white p-5">
          <div className="text-sm text-meta-3">Total orders</div>
          <div className="mt-2 text-2xl font-semibold text-dark">{orderCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-3 bg-white p-5">
          <div className="text-sm text-meta-3">Revenue (paid)</div>
          <div className="mt-2 text-2xl font-semibold text-dark">{formatPrice(revenue)}</div>
        </div>
        <div className="rounded-2xl border border-gray-3 bg-white p-5">
          <div className="text-sm text-meta-3">Pending orders</div>
          <div className="mt-2 text-2xl font-semibold text-dark">{pendingOrders}</div>
        </div>
        <Link
          href="/admin/inventory"
          className={`rounded-2xl border p-5 block transition hover:shadow-sm ${
            lowStock > 0 ? "border-orange-200 bg-orange-50" : "border-gray-3 bg-white"
          }`}
        >
          <div className={`text-sm ${lowStock > 0 ? "text-orange-600" : "text-meta-3"}`}>Low stock SKUs</div>
          <div className={`mt-2 text-2xl font-semibold ${lowStock > 0 ? "text-orange-700" : "text-dark"}`}>
            {lowStock > 0 ? `⚠️ ${lowStock}` : lowStock}
          </div>
          {lowStock > 0 && <div className="mt-1 text-xs text-orange-500">Click to review →</div>}
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-5">
        <p className="text-sm text-meta-3">
          This dashboard is intentionally lightweight (fast server render). Next we’ll add product,
          inventory, order, coupon, and review management screens.
        </p>
      </div>
    </div>
  );
}

