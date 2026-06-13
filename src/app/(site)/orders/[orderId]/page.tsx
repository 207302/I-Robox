import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { formatPrice } from "@/utils/formatePrice";
import { formatOrderReference } from "@/utils/orderNumber";
import OrderTracking from "@/components/OrderTracking";
import { resolveOrderTrackingStatus, syncShipmozoTrackingForOrder } from "@/lib/shipping/shipmozoTracking";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ access?: string }>;
};

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const { access } = await searchParams;
  const session = await getSession();

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      customer_id: true,
      status: true,
      payment_status: true,
      subtotal_amount: true,
      discount_amount: true,
      total_amount: true,
      created_at: true,
      is_gift: true,
      gift_message: true,
      awb_number: true,
      carrier: true,
      shipment_status: true,
      shipment_updated_at: true,
      shipment_location: true,
      order_items: {
        select: { id: true, product_name: true, quantity: true, unit_price: true, subtotal_amount: true },
      },
      shipments: { select: { status: true, tracking_number: true, carrier: true } },
      addresses_orders_shipping_address_idToaddresses: {
        select: {
          full_name: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
        },
      },
    },
  });

  if (!order) notFound();
  const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
  const hasCheckoutAccess = Boolean(access && verifyOrderAccessToken(access, order.id));
  if (!isOwner && !hasCheckoutAccess) {
    return (
      <section className="pt-36 pb-16">
        <div className="w-full px-4 mx-auto max-w-3xl sm:px-6">
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">
              You do not have access to this order. Please sign in with the account that placed it.
            </p>
            <Link href="/login" className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  await syncShipmozoTrackingForOrder(orderId);

  const refreshed = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      customer_id: true,
      status: true,
      payment_status: true,
      subtotal_amount: true,
      discount_amount: true,
      total_amount: true,
      created_at: true,
      is_gift: true,
      gift_message: true,
      awb_number: true,
      carrier: true,
      shipment_status: true,
      shipment_updated_at: true,
      shipment_location: true,
      order_items: {
        select: { id: true, product_name: true, quantity: true, unit_price: true, subtotal_amount: true },
      },
      shipments: { select: { status: true, tracking_number: true, carrier: true } },
      addresses_orders_shipping_address_idToaddresses: {
        select: {
          full_name: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
        },
      },
    },
  });
  if (refreshed) {
    Object.assign(order, refreshed);
  }

  const trackingStatus = resolveOrderTrackingStatus({
    shipment_status: order.shipment_status,
    awb_number: order.awb_number,
    legacy_shipment_status: order.shipments?.status ? String(order.shipments.status) : null,
    legacy_tracking_number: order.shipments?.tracking_number ?? null,
  });
  const trackingAwb = order.awb_number ?? order.shipments?.tracking_number ?? null;
  const trackingCarrier = order.carrier ?? order.shipments?.carrier ?? null;

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-5xl sm:px-8 xl:px-0">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-dark">Order details</h1>
          <Link href="/orders" className="text-sm font-medium text-blue hover:underline">
            Back to orders
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,_1fr)_360px]">
          <div className="rounded-2xl border border-gray-3 bg-white">
            <div className="p-5 sm:p-6 border-b border-gray-3">
              <div className="text-sm text-meta-3">Order</div>
              <div className="font-semibold text-dark">{formatOrderReference(order)}</div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-gray-1 px-3 py-1 border border-gray-3">
                  Status: <b>{String(order.status)}</b>
                </span>
                <span className="rounded-full bg-gray-1 px-3 py-1 border border-gray-3">
                  Payment: <b>{String(order.payment_status)}</b>
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-3">
              {order.order_items.map((it) => (
                <div key={it.id} className="p-5 sm:p-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-dark">{it.product_name}</div>
                    <div className="mt-1 text-sm text-meta-3">
                      Qty: {it.quantity} • Unit: {formatPrice(Number(it.unit_price))}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-dark">
                    {formatPrice(Number(it.subtotal_amount))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-gray-3 bg-white p-5">
              <h2 className="text-lg font-semibold text-dark">Totals</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-meta-3">Subtotal</span>
                  <span className="font-medium text-dark">{formatPrice(Number(order.subtotal_amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-meta-3">Discount</span>
                  <span className="font-medium text-dark">-{formatPrice(Number(order.discount_amount))}</span>
                </div>
                <div className="flex justify-between border-t border-gray-3 pt-2">
                  <span className="text-meta-3">Total</span>
                  <span className="font-semibold text-dark">{formatPrice(Number(order.total_amount))}</span>
                </div>
              </div>
              <Link
                href={
                  access
                    ? `/orders/${order.id}/invoice/download?access=${encodeURIComponent(access)}`
                    : `/orders/${order.id}/invoice/download`
                }
                className="mt-4 inline-flex w-full justify-center rounded-lg border border-gray-3 bg-white px-5 py-2.5 text-sm font-medium text-dark hover:bg-gray-1 transition"
              >
                Download invoice (PDF)
              </Link>
            </div>

            <div className="rounded-2xl border border-gray-3 bg-white p-5">
              <h2 className="text-lg font-semibold text-dark">Shipping address</h2>
              {order.addresses_orders_shipping_address_idToaddresses ? (
                <div className="mt-3 text-sm text-meta-3 space-y-1">
                  <div className="font-medium text-dark">
                    {order.addresses_orders_shipping_address_idToaddresses.full_name}
                  </div>
                  <div>
                    {order.addresses_orders_shipping_address_idToaddresses.line1}
                    {order.addresses_orders_shipping_address_idToaddresses.line2
                      ? `, ${order.addresses_orders_shipping_address_idToaddresses.line2}`
                      : ""}
                  </div>
                  <div>
                    {order.addresses_orders_shipping_address_idToaddresses.city},{" "}
                    {order.addresses_orders_shipping_address_idToaddresses.state}{" "}
                    {order.addresses_orders_shipping_address_idToaddresses.postal_code}
                  </div>
                  <div>{order.addresses_orders_shipping_address_idToaddresses.country}</div>
                  <div>{order.addresses_orders_shipping_address_idToaddresses.phone}</div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-meta-3">Shipping address unavailable.</p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-3 bg-white p-5">
              <h2 className="text-lg font-semibold text-dark">Shipment</h2>
              <OrderTracking
                status={trackingStatus}
                awb_number={trackingAwb}
                carrier={trackingCarrier}
                shipment_updated_at={order.shipment_updated_at?.toISOString() ?? null}
              />
              {order.shipment_location ? (
                <p className="mt-3 text-sm text-meta-3">
                  Latest location: <span className="text-dark">{order.shipment_location}</span>
                </p>
              ) : null}
              {!order.shipments && trackingStatus === "ORDER_PLACED" ? (
                <p className="mt-3 text-sm text-meta-3">
                  Shipment will be created after payment confirmation.
                </p>
              ) : null}
            </div>

            {order.is_gift ? (
              <div className="rounded-2xl border border-gray-3 bg-white p-5">
                <h2 className="text-lg font-semibold text-dark">Gift</h2>
                <p className="mt-3 text-sm text-meta-3">
                  Gift message: <span className="text-dark">{order.gift_message ?? "—"}</span>
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

