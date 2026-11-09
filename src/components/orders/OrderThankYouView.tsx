import Link from "next/link";
import { Check, Mail, Package, ShieldCheck } from "lucide-react";
import SafeProductImage from "@/components/Common/SafeProductImage";
import { formatPrice } from "@/utils/formatePrice";

export type ThankYouLine = {
  id: string;
  name: string;
  variant?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  image?: string | null;
  href?: string | null;
};

export type ThankYouAddress = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type OrderThankYouViewProps = {
  customerFirstName: string | null;
  orderReference: string;
  placedAtLabel: string;
  email: string | null;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  tax: number;
  total: number;
  lines: ThankYouLine[];
  address: ThankYouAddress | null;
  isGift: boolean;
  giftMessage: string | null;
  orderHref: string;
  invoiceHref: string;
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function OrderThankYouView({
  customerFirstName,
  orderReference,
  placedAtLabel,
  email,
  subtotal,
  discount,
  couponCode,
  shipping,
  tax,
  total,
  lines,
  address,
  isGift,
  giftMessage,
  orderHref,
  invoiceHref,
}: OrderThankYouViewProps) {
  const productCount = lines.length;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

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
            {customerFirstName ? `Thank you, ${customerFirstName}.` : "Thank you."}
          </h1>
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                You paid
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">{formatPrice(total)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Products
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">{productCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Cart items
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">{itemCount}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70">{orderReference}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Your payment cleared, and this order is confirmed.{" "}
            {countLabel(productCount, "product", "products")},{" "}
            {countLabel(itemCount, "item", "items")}. We’ll pack them the way we’d want them to
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
              <p className="mt-1 text-sm text-meta-3">{placedAtLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-1 px-3 py-1 text-xs font-semibold text-dark">
                {countLabel(productCount, "product", "products")}
              </span>
              <span className="rounded-full bg-blue-light-5 px-3 py-1 text-xs font-semibold text-blue">
                {countLabel(itemCount, "cart item", "cart items")}
              </span>
              <span className="rounded-full bg-green-light-6 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-dark">
                Paid
              </span>
            </div>
          </div>

          <ul className="divide-y divide-gray-3">
            {lines.map((item) => {
              const title = <p className="font-semibold text-dark">{item.name}</p>;
              return (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4 sm:px-7">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-1">
                    <SafeProductImage
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.href ? (
                      <Link href={item.href} className="hover:text-blue">
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                    {item.variant && item.variant !== item.name ? (
                      <p className="mt-0.5 text-xs text-meta-3">{item.variant}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-meta-3">
                      Qty {item.quantity} · {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-dark">
                    {formatPrice(item.subtotal)}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 border-t border-gray-3 px-5 py-5 text-sm sm:px-7">
            <div className="flex items-center justify-between gap-4">
              <span className="text-meta-3">Products ordered</span>
              <span className="font-medium tabular-nums text-dark">{productCount}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-meta-3">Cart count</span>
              <span className="font-medium tabular-nums text-dark">{itemCount}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-meta-3">Subtotal</span>
              <span className="font-medium tabular-nums text-dark">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-meta-3">
                  Discount
                  {couponCode ? ` (${couponCode})` : ""}
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
              <span className="text-lg font-bold tabular-nums text-blue">{formatPrice(total)}</span>
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
                <p className="font-medium text-dark">{address.fullName}</p>
                <p>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                </p>
                <p>
                  {[address.city, address.state].filter(Boolean).join(", ")} {address.postalCode}
                </p>
                <p>{address.country}</p>
                <p>{address.phone}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-meta-3">Shipping address unavailable.</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-3 bg-white p-5">
            <h2 className="text-sm font-semibold text-dark">
              {isGift ? "Gift note" : "What happens next"}
            </h2>
            {isGift ? (
              <p className="mt-3 text-sm leading-relaxed text-meta-3">
                {giftMessage
                  ? `We’ll include your note: “${giftMessage}”`
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
          {invoiceHref ? (
            <Link
              href={invoiceHref}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-3 bg-white px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gray-1"
            >
              Download invoice
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
