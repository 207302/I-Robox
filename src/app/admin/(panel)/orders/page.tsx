import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/utils/formatePrice";

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
  const orders = await prisma.orders.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      payment_status: true,
      total_amount: true,
      created_at: true,
      customer_id: true,
      customers: { select: { email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Orders</h1>

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-3">
                <td className="py-3 px-4">
                  <div className="font-semibold text-dark">{o.id}</div>
                  <div className="text-xs text-meta-4">
                    {formatDateTimeIst(o.created_at)}
                  </div>
                </td>
                <td className="py-3 px-4 text-dark">
                  {o.customers?.email ?? o.customer_id ?? "Guest"}
                </td>
                <td className="py-3 px-4 text-dark">{String(o.status)}</td>
                <td className="py-3 px-4 text-dark">{String(o.payment_status)}</td>
                <td className="py-3 px-4 text-dark">{formatPrice(Number(o.total_amount))}</td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-sm font-medium text-blue hover:underline"
                  >
                    View / update
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={6}>
                  No orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

