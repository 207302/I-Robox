import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { formatPrice } from "@/utils/formatePrice";
import { toOrderNumber } from "@/utils/orderNumber";

export const metadata = {
  title: "Orders | i-Robox",
};

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) {
    return (
      <section className="pt-36 pb-16">
        <div className="w-full px-4 mx-auto max-w-3xl sm:px-6">
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">Please sign in to view your orders.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const orders = await prisma.orders.findMany({
    where: { customer_id: session.sub },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      status: true,
      payment_status: true,
      total_amount: true,
      created_at: true,
      addresses_orders_shipping_address_idToaddresses: {
        select: { line1: true, line2: true, city: true, state: true, postal_code: true },
      },
      order_items: { select: { product_name: true, quantity: true }, take: 2 },
    },
  });

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-5xl sm:px-8 xl:px-0">
        <h1 className="text-2xl font-semibold text-dark mb-8">Orders</h1>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">No orders yet.</p>
            <Link
              href="/shop"
              className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-3 bg-white divide-y divide-gray-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="p-4 sm:p-6 block hover:bg-gray-1 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-meta-3">Order</div>
                    <div className="font-semibold text-dark">{toOrderNumber(o.id)}</div>
                    {o.addresses_orders_shipping_address_idToaddresses ? (
                      <div className="mt-1 text-xs text-meta-3 line-clamp-1">
                        {o.addresses_orders_shipping_address_idToaddresses.line1}
                        {o.addresses_orders_shipping_address_idToaddresses.line2
                          ? `, ${o.addresses_orders_shipping_address_idToaddresses.line2}`
                          : ""}
                        , {o.addresses_orders_shipping_address_idToaddresses.city},{" "}
                        {o.addresses_orders_shipping_address_idToaddresses.state}{" "}
                        {o.addresses_orders_shipping_address_idToaddresses.postal_code}
                      </div>
                    ) : null}
                    {o.order_items.length ? (
                      <div className="mt-1 text-xs text-meta-3 line-clamp-1">
                        {o.order_items
                          .map((it) => `${it.product_name} x${it.quantity}`)
                          .join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Total</div>
                    <div className="font-semibold text-dark">{formatPrice(Number(o.total_amount))}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Status</div>
                    <div className="font-semibold text-dark">{String(o.status)}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Payment</div>
                    <div className="font-semibold text-dark">{String(o.payment_status)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

