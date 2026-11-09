import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { isOrderOwnedByCustomer } from "@/lib/orders/orderOwnership";
import { resolveLiveCustomerId } from "@/lib/orders/resolveOrderCustomer";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { formatOrderReference } from "@/utils/orderNumber";
import ThankYouAwaiting from "@/components/orders/ThankYouAwaiting";
import OrderThankYouView from "@/components/orders/OrderThankYouView";

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
  const email = order.customers?.email
    ? displayEmailForCustomer(order.customers.email)
    : null;
  const invoiceHref = access
    ? `/orders/${order.id}/invoice/download?access=${encodeURIComponent(access)}`
    : `/orders/${order.id}/invoice/download`;

  return (
    <OrderThankYouView
      customerFirstName={firstName(address?.full_name)}
      orderReference={formatOrderReference(order)}
      placedAtLabel={formatWhen(order.created_at)}
      email={email}
      subtotal={Number(order.subtotal_amount)}
      discount={Number(order.discount_amount)}
      couponCode={order.coupons?.code ?? null}
      shipping={Number(order.shipping_amount)}
      tax={Number(order.tax_amount)}
      total={Number(order.total_amount)}
      lines={order.order_items.map((item) => ({
        id: item.id,
        name: item.product_name,
        variant: item.product_variants?.name ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal_amount),
        image:
          item.product_variants?.product_images[0]?.url ??
          item.products?.product_images[0]?.url ??
          null,
        href: item.products?.slug ? `/shop/${item.products.slug}` : null,
      }))}
      address={
        address
          ? {
              fullName: address.full_name?.trim() ?? "",
              line1: address.line1?.trim() ?? "",
              line2: address.line2?.trim() || null,
              city: address.city?.trim() ?? "",
              state: address.state?.trim() ?? "",
              postalCode: address.postal_code?.trim() ?? "",
              country: address.country?.trim() ?? "",
              phone: address.phone ?? "",
            }
          : null
      }
      isGift={order.is_gift}
      giftMessage={order.gift_message?.trim() || null}
      orderHref={orderHref}
      invoiceHref={invoiceHref}
    />
  );
}
