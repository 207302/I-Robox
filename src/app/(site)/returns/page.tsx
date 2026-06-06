import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { formatOrderReference } from "@/utils/orderNumber";

export const metadata = {
  title: "Returns | i-Robox",
};

export default async function ReturnsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <section className="pt-36 pb-16">
        <div className="w-full px-4 mx-auto max-w-3xl sm:px-6">
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">Please sign in to view returns.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const returns = await prisma.returns.findMany({
    where: { customer_id: session.sub },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      status: true,
      quantity: true,
      created_at: true,
      order_id: true,
      orders: { select: { id: true, order_number: true } },
    },
    take: 50,
  });

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-5xl sm:px-8 xl:px-0">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-dark">Returns</h1>
          <Link href="/orders" className="text-sm font-medium text-blue hover:underline">
            View orders
          </Link>
        </div>

        {returns.length === 0 ? (
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">No return requests yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-3 bg-white divide-y divide-gray-3">
            {returns.map((r) => (
              <div key={r.id} className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-meta-3">Return</div>
                    <div className="font-semibold text-dark">{r.id}</div>
                    <div className="mt-1 text-xs text-meta-4">
                      Order: {r.orders ? formatOrderReference(r.orders) : r.order_id}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Qty</div>
                    <div className="font-semibold text-dark">{r.quantity}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Status</div>
                    <div className="font-semibold text-dark">{String(r.status)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

