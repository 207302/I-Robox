import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { formatPrice } from "@/utils/formatePrice";
import { formatOrderReference } from "@/utils/orderNumber";
import { loadOrderInvoiceTaxLines, sumOrderInvoiceTax } from "@/lib/invoices/orderInvoiceTax";

const SELLER_GSTIN = process.env.SELLER_GSTIN || process.env.SHIPMOZO_GSTIN || "";

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

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ access?: string }>;
};

export const metadata = {
  title: "Invoice | i-Robox",
};

export default async function InvoicePage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const { access } = await searchParams;
  const session = await getSession();

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      customer_id: true,
      created_at: true,
      subtotal_amount: true,
      discount_amount: true,
      shipping_amount: true,
      tax_amount: true,
      total_amount: true,
      currency: true,
      order_items: {
        select: {
          id: true,
          product_id: true,
          product_name: true,
          quantity: true,
          unit_price: true,
          subtotal_amount: true,
        },
      },
      addresses_orders_shipping_address_idToaddresses: {
        select: { full_name: true, line1: true, line2: true, city: true, state: true, postal_code: true, country: true, phone: true },
      },
    },
  });
  if (!order) notFound();
  const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
  const hasCheckoutAccess = Boolean(access && verifyOrderAccessToken(access, order.id));
  if (!isOwner && !hasCheckoutAccess) notFound();

  const taxLines = await loadOrderInvoiceTaxLines(order.order_items);
  const taxByItemId = new Map(
    order.order_items.map((item) => [item.id, taxLines.find((line) => line.productId === item.product_id)])
  );
  const taxTotals = sumOrderInvoiceTax(taxLines);

  return (
    <main className="pt-28 pb-16 bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <h1 className="text-2xl font-semibold text-dark">Invoice</h1>
          <div className="flex items-center gap-2">
            <a
              href={access ? `/orders/${order.id}/invoice/download?access=${encodeURIComponent(access)}` : `/orders/${order.id}/invoice/download`}
              className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition"
            >
              Download PDF
            </a>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-3 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-sm text-meta-3">Invoice for order</div>
              <div className="text-lg font-semibold text-dark">{formatOrderReference(order)}</div>
              <div className="mt-2 text-sm text-meta-3">
                Date: {formatDateTimeIst(order.created_at)}
              </div>
              {SELLER_GSTIN ? (
                <div className="mt-1 text-sm text-meta-3">GSTIN: {SELLER_GSTIN}</div>
              ) : null}
            </div>

            <div className="max-w-sm">
              <div className="text-sm font-semibold text-dark">Ship to</div>
              <div className="mt-2 text-sm text-meta-3">
                <div className="font-medium text-dark">
                  {order.addresses_orders_shipping_address_idToaddresses?.full_name ?? "—"}
                </div>
                <div>
                  {order.addresses_orders_shipping_address_idToaddresses?.line1}
                  {order.addresses_orders_shipping_address_idToaddresses?.line2
                    ? `, ${order.addresses_orders_shipping_address_idToaddresses.line2}`
                    : ""}
                </div>
                <div>
                  {order.addresses_orders_shipping_address_idToaddresses?.city},{" "}
                  {order.addresses_orders_shipping_address_idToaddresses?.state}{" "}
                  {order.addresses_orders_shipping_address_idToaddresses?.postal_code}
                </div>
                <div>{order.addresses_orders_shipping_address_idToaddresses?.country}</div>
                <div>{order.addresses_orders_shipping_address_idToaddresses?.phone}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-meta-3 border-b border-gray-3">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">HSN</th>
                  <th className="py-2 pr-3">GST%</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3 text-right">Taxable</th>
                  <th className="py-2 pr-3 text-right">GST</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items.map((it) => {
                  const tax = taxByItemId.get(it.id);
                  return (
                    <tr key={it.id} className="border-b border-gray-3">
                      <td className="py-3 pr-3 text-dark">{it.product_name}</td>
                      <td className="py-3 pr-3 text-dark">{tax?.hsn ?? "--"}</td>
                      <td className="py-3 pr-3 text-dark">
                        {tax && tax.gstPercent > 0 ? `${tax.gstPercent}%` : "--"}
                      </td>
                      <td className="py-3 pr-3 text-dark">{it.quantity}</td>
                      <td className="py-3 pr-3 text-dark">{formatPrice(Number(it.unit_price))}</td>
                      <td className="py-3 pr-3 text-right text-dark">
                        {formatPrice(tax?.taxableTotal ?? Number(it.subtotal_amount))}
                      </td>
                      <td className="py-3 pr-3 text-right text-dark">{formatPrice(tax?.gstTotal ?? 0)}</td>
                      <td className="py-3 text-right text-dark font-semibold">
                        {formatPrice(Number(it.subtotal_amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-meta-3">Taxable value</span>
              <span className="text-dark font-medium">{formatPrice(taxTotals.taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-meta-3">GST</span>
              <span className="text-dark font-medium">{formatPrice(taxTotals.gst)}</span>
            </div>
            {Number(order.discount_amount) > 0 ? (
              <div className="flex justify-between">
                <span className="text-meta-3">Discount</span>
                <span className="text-dark font-medium">-{formatPrice(Number(order.discount_amount))}</span>
              </div>
            ) : null}
            {Number(order.shipping_amount) > 0 ? (
              <div className="flex justify-between">
                <span className="text-meta-3">Shipping</span>
                <span className="text-dark font-medium">{formatPrice(Number(order.shipping_amount))}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-gray-3 pt-2">
              <span className="text-meta-3">Grand total</span>
              <span className="text-dark font-semibold">{formatPrice(Number(order.total_amount))}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

