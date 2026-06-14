import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { adminProductImageSelect, firstProductImageUrl } from "@/lib/admin/productThumbnail";
import {
  CustomerOrdersList,
  type CustomerOrderRow,
} from "@/components/orders/CustomerOrdersList";
import { formatOrderReference } from "@/utils/orderNumber";

export const metadata = {
  title: "Orders | i-Robox",
};

function formatShippingLine(
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
  } | null
): string | null {
  if (!address) return null;
  const parts = [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postal_code}`,
  ].filter(Boolean);
  return parts.join(", ") || null;
}

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
      order_number: true,
      status: true,
      payment_status: true,
      total_amount: true,
      addresses_orders_shipping_address_idToaddresses: {
        select: { line1: true, line2: true, city: true, state: true, postal_code: true },
      },
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

  const rows: CustomerOrderRow[] = orders.map((o) => {
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
      orderRef: formatOrderReference(o),
      status: String(o.status),
      paymentStatus: String(o.payment_status),
      totalAmount: Number(o.total_amount),
      shippingLine: formatShippingLine(o.addresses_orders_shipping_address_idToaddresses),
      products: [...productMap.values()],
    };
  });

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-5xl sm:px-8 xl:px-0">
        <h1 className="text-2xl font-semibold text-dark mb-8">Orders</h1>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">No orders yet.</p>
            <Link
              href="/shop"
              prefetch={false}
              className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <CustomerOrdersList orders={rows} />
        )}
      </div>
    </section>
  );
}
