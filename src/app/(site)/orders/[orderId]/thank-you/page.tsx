import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Mail, Package, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { isOrderOwnedByCustomer } from "@/lib/orders/orderOwnership";
import { resolveLiveCustomerId } from "@/lib/orders/resolveOrderCustomer";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { formatPrice } from "@/utils/formatePrice";
import { formatOrderReference } from "@/utils/orderNumber";
import SafeProductImage from "@/components/Common/SafeProductImage";
import ThankYouAwaiting from "@/components/orders/ThankYouAwaiting";

export const metadata: Metadata = {
  title: "Thank you | i-Robox",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{
    access?: string;
    razorpay_payment_id?: string;
    razorpay_payment_link_status?: string;
  }>;
};

const CLOSED_STATUSES = new Set([
  "PAYMENT_FAILED",
  "CANCELLED",
  "REFUNDED",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "RETURN_REJECTED",
]);

function formatWhen(value: Date) {
  return value.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function firstName(fullName: string | null | undefined) {
  const token = fullName?.trim().split(/\s+/)[0];
  return token || null;
}

export default async function OrderThankYouPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const { access, razorpay_payment_id, razorpay_payment_link_status } = await searchParams;

  const [session, order] = await Promise.all([
    getSession(),
    prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      customer_id: true,
      status: true,
      payment_status: true,
      subtotal_amount: true,
      discount_amount: true,
      shipping_amount: true,
      tax_amount: true,
      total_amount: true,
      created_at: true,
      is_gift: true,
      gift_message: true,
      coupons: { select: { code: true } },
      order_items: {
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          product_name: true,
          quantity: true,
          unit_price: true,
          subtotal_amount: true,
          products: {
            select: {
              slug: true,
              product_images: {
                where: { product_variant_id: null },
                orderBy: { sort_order: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
          product_variants: {
            select: {
              name: true,
              product_images: {
                orderBy: { sort_order: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
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
      customers: { select: { email: true } },
    },
    }),
  ]);

  if (!order) notFound();

  const sessionCustomerId = await resolveLiveCustomerId(session);
  const isOwner = isOrderOwnedByCustomer(order.customer_id, sessionCustomerId);
  const hasCheckoutAccess = Boolean(access && verifyOrderAccessToken(access, order.id));
  const tokenQuery = access ? `?access=${encodeURIComponent(access)}` : "";
  const orderHref = `/orders/${order.id}${tokenQuery}`;

  if (!isOwner && !hasCheckoutAccess) {
    return (
      <section className="bg-gray-1 pb-16 pt-[220px] sm:pt-[232px]">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">
              You do not have access to this order. Please sign in with the account that placed it.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/orders/${order.id}/thank-you${tokenQuery}`)}`}
              className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-dark"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const paid =
    order.payment_status === "SUCCEEDED" && !CLOSED_STATUSES.has(String(order.status));
  const paymentReturnPending =
    order.payment_status === "PENDING" &&
    (order.status === "PENDING" || order.status === "CONFIRMED") &&
    (Boolean(razorpay_payment_id) || razorpay_payment_link_status === "paid");

  if (!paid) {
    if (paymentReturnPending) return <ThankYouAwaiting orderHref={orderHref} />;
    redirect(orderHref);
  }

  const address = order.addresses_orders_shipping_address_idToaddresses;
  const name = firstName(address?.full_name);
  const email = order.customers?.email
    ? displayEmailForCustomer(order.customers.email)
    : null;
  const pieceCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const invoiceHref = access
    ? `/orders/${order.id}/invoice/download?access=${encodeURIComponent(access)}`
    : `/orders/${order.id}/invoice/download`;
  const discount = Number(order.discount_amount);
  const shipping = Number(order.shipping_amount);
  const tax = Number(order.tax_amount);

  return (
    <section className="bg-gray-1 pb-20">
      <div className="relative overflow-hidden bg-dark px-4 pb-28 pt-[220px] text-white sm:px-8 sm:pt-[232px]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 30%, rgba(196,30,58,0.55), transparent 34%), radial-gradient(circle at 88% 0%, rgba(255,255,255,0.1), transparent 30%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue">
              <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
            </span>
            Order confirmed
          </div>
          <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.05] sm:text-5xl">
            {name ? `Thank you, ${name}.` : "Thank you."}
          </h1>
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                You paid
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
                {formatPrice(Number(order.total_amount))}
              </p>
            </div>
            <p className="pb-1 text-sm text-white/70">{formatOrderReference(order)}</p>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Your payment cleared, and this order is confirmed. We’ll pack{" "}
            {pieceCount === 1 ? "it" : `these ${pieceCount} pieces`} the way we’d want them to
            arrive on our own shelf.
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-12 w-full max-w-3xl px-4 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-gray-3 bg-white shadow-[0_18px_50px_rgba(28,39,76,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-gray-3 px-5 py-4 sm:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-meta-4">
                Packing slip
              </p>
              <p className="mt-1 text-sm text-meta-3">{formatWhen(order.created_at)}</p>
            </div>
            <span className="rounded-full bg-green-light-6 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-dark">
              Paid
            </span>
          </div>

          <ul className="divide-y divide-gray-3">
            {order.order_items.map((item) => {
              const image =
                item.product_variants?.product_images[0]?.url ??
                item.products?.product_images[0]?.url ??
                null;
              const variant = item.product_variants?.name?.trim();
              const slug = item.products?.slug;
              const title = (
                <p className="font-semibold text-dark">{item.product_name}</p>
              );
              return (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4 sm:px-7">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-1">
                    <SafeProductImage
                      src={image}
                      alt={item.product_name}
                      fill
                      sizes="64px"
                      className="object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {slug ? (
                      <Link href={`/shop/${slug}`} className="hover:text-blue">
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                    {variant && variant !== item.product_name ? (
                      <p className="mt-0.5 text-xs text-meta-3">{variant}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-meta-3">
                      Qty {item.quantity} · {formatPrice(Number(item.unit_price))} each
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-dark">
                    {formatPrice(Number(item.subtotal_amount))}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 border-t border-gray-3 px-5 py-5 text-sm sm:px-7">
            <div className="flex items-center justify-between gap-4">
              <span className="text-meta-3">Subtotal</span>
              <span className="font-medium tabular-nums text-dark">
                {formatPrice(Number(order.subtotal_amount))}
              </span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-meta-3">
                  Discount
                  {order.coupons?.code ? ` (${order.coupons.code})` : ""}
                </span>
                <span className="font-medium tabular-nums text-dark">−{formatPrice(discount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <span className="text-meta-3">Delivery charge</span>
              <span className="font-medium tabular-nums text-dark">
                {shipping === 0 ? "Free" : formatPrice(shipping)}
              </span>
            </div>
            {tax > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-meta-3">Tax</span>
                <span className="font-medium tabular-nums text-dark">{formatPrice(tax)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 border-t border-gray-3 pt-3">
              <span className="font-semibold text-dark">Order total</span>
              <span className="text-lg font-bold tabular-nums text-blue">
                {formatPrice(Number(order.total_amount))}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              Icon: ShieldCheck,
              title: "Payment settled",
              body: "Razorpay captured it and we confirmed the order.",
            },
            {
              Icon: Package,
              title: "Packed with care",
              body: "Secure packaging before it leaves the shelf.",
            },
            {
              Icon: Mail,
              title: "Receipt on the way",
              body: email ? `We’ll write to ${email}.` : "A confirmation email is on its way.",
            },
          ].map((step) => (
            <div key={step.title} className="rounded-2xl border border-gray-3 bg-white p-4">
              <step.Icon className="h-5 w-5 text-blue" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-dark">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-meta-3">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-3 bg-white p-5">
            <h2 className="text-sm font-semibold text-dark">Ships to</h2>
            {address ? (
              <div className="mt-3 space-y-1 text-sm text-meta-3">
                <p className="font-medium text-dark">{address.full_name?.trim()}</p>
                <p>
                  {address.line1?.trim()}
                  {address.line2?.trim() ? `, ${address.line2.trim()}` : ""}
                </p>
                <p>
                  {[address.city, address.state]
                    .map((part) => part?.trim())
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {address.postal_code?.trim()}
                </p>
                <p>{address.country?.trim()}</p>
                <p>{address.phone}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-meta-3">Shipping address unavailable.</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-3 bg-white p-5">
            <h2 className="text-sm font-semibold text-dark">
              {order.is_gift ? "Gift note" : "What happens next"}
            </h2>
            {order.is_gift ? (
              <p className="mt-3 text-sm leading-relaxed text-meta-3">
                {order.gift_message?.trim()
                  ? `We’ll include your note: “${order.gift_message.trim()}”`
                  : "This order is marked as a gift. We’ll pack it without a price slip fuss."}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-meta-3">
                Tracking shows up on the order once the shipment is booked. You can download the
                invoice any time from there.
              </p>
            )}
            <Link href={orderHref} className="mt-3 inline-flex text-sm font-semibold text-blue hover:underline">
              View order details
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-dark"
          >
            Continue shopping
          </Link>
          <Link
            href={invoiceHref}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-3 bg-white px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gray-1"
          >
            Download invoice
          </Link>
        </div>
      </div>
    </section>
  );
}
