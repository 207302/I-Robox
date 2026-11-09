import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderThankYouView, { type ThankYouLine } from "@/components/orders/OrderThankYouView";

export const metadata: Metadata = {
  title: "Thank you | i-Robox",
  robots: { index: false, follow: false },
};

const SAMPLE_QTY = [2, 1, 1, 3];

const FALLBACK_LINES: ThankYouLine[] = [
  {
    id: "preview-1",
    name: "Hot Wheels Premium Formula 1 — Oracle Red Bull Racing",
    quantity: 2,
    unitPrice: 799,
    subtotal: 1598,
    href: "/shop",
  },
  {
    id: "preview-2",
    name: "Hot Wheels Silver Series Porsche 356 Outlaw",
    quantity: 1,
    unitPrice: 299,
    subtotal: 299,
    href: "/shop",
  },
  {
    id: "preview-3",
    name: "Mini GT LB-Works Lamborghini Huracán",
    quantity: 1,
    unitPrice: 179,
    subtotal: 179,
    href: "/shop",
  },
  {
    id: "preview-4",
    name: "Majorette Ferrari 12Cilindri",
    quantity: 3,
    unitPrice: 179,
    subtotal: 537,
    href: "/shop",
  },
];

export default async function PreviewThankYouPage() {
  if (process.env.NODE_ENV === "production") notFound();

  let lines = FALLBACK_LINES;
  try {
    const products = await prisma.products.findMany({
      where: { is_active: true },
      orderBy: { updated_at: "desc" },
      take: SAMPLE_QTY.length,
      select: {
        id: true,
        name: true,
        slug: true,
        base_price: true,
        discounted_price: true,
        product_images: {
          where: { product_variant_id: null },
          orderBy: { sort_order: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    });
    if (products.length > 0) {
      lines = products.map((product, index) => {
        const quantity = SAMPLE_QTY[index] ?? 1;
        const unitPrice = Number(product.discounted_price ?? product.base_price);
        return {
          id: product.id,
          name: product.name,
          quantity,
          unitPrice,
          subtotal: unitPrice * quantity,
          image: product.product_images[0]?.url ?? null,
          href: `/shop/${product.slug}`,
        };
      });
    }
  } catch (err) {
    console.error("[preview thank-you] using sample lines", err);
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const discount = Math.min(200, Math.round(subtotal * 0.1));
  const total = Math.max(0, subtotal - discount);

  return (
    <OrderThankYouView
      customerFirstName="Alex"
      orderReference="IRx10421"
      placedAtLabel={new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
      email="alex@example.com"
      subtotal={subtotal}
      discount={discount}
      couponCode={discount > 0 ? "WELCOME10" : null}
      shipping={0}
      tax={0}
      total={total}
      lines={lines}
      address={{
        fullName: "Alex Mehta",
        line1: "12, Sample Layout",
        line2: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        country: "India",
        phone: "+91 98000 00000",
      }}
      isGift={false}
      giftMessage={null}
      orderHref="/preview/thank-you"
      invoiceHref=""
    />
  );
}
