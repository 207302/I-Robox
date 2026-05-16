import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/utils/formatePrice";

export const metadata = {
  title: "Admin Analytics | i-Robox",
};

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [paid7d, paid30d, topProducts] = await Promise.all([
    prisma.orders.aggregate({
      where: { payment_status: "SUCCEEDED", created_at: { gte: since7d } },
      _sum: { total_amount: true },
      _count: { _all: true },
    }),
    prisma.orders.aggregate({
      where: { payment_status: "SUCCEEDED", created_at: { gte: since30d } },
      _sum: { total_amount: true },
      _count: { _all: true },
    }),
    prisma.order_items.groupBy({
      by: ["product_id", "product_name"],
      _sum: { quantity: true, subtotal_amount: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
  ]);

  const revenue7d = Number(paid7d._sum.total_amount ?? 0);
  const revenue30d = Number(paid30d._sum.total_amount ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-3 bg-white p-5">
          <div className="text-sm text-meta-3">Paid orders (last 7 days)</div>
          <div className="mt-2 text-2xl font-semibold text-dark">{paid7d._count._all}</div>
          <div className="mt-1 text-sm text-dark">{formatPrice(revenue7d)}</div>
        </div>
        <div className="rounded-2xl border border-gray-3 bg-white p-5">
          <div className="text-sm text-meta-3">Paid orders (last 30 days)</div>
          <div className="mt-2 text-2xl font-semibold text-dark">{paid30d._count._all}</div>
          <div className="mt-1 text-sm text-dark">{formatPrice(revenue30d)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-5">
        <h2 className="text-lg font-semibold text-dark">Top products (by quantity)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-meta-3 border-b border-gray-3">
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Qty sold</th>
                <th className="py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={`${p.product_id}`} className="border-b border-gray-3">
                  <td className="py-3 pr-4 text-dark font-medium">{p.product_name}</td>
                  <td className="py-3 pr-4 text-dark">{p._sum.quantity ?? 0}</td>
                  <td className="py-3 text-right text-dark font-semibold">
                    {formatPrice(Number(p._sum.subtotal_amount ?? 0))}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 ? (
                <tr>
                  <td className="py-6 text-sm text-meta-3" colSpan={3}>
                    No data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

