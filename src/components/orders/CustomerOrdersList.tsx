"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { AdminProductThumbnail } from "@/components/admin/AdminProductThumbnail";
import { productImageAlt } from "@/lib/seo/metadata";
import { formatPrice } from "@/utils/formatePrice";

export type CustomerOrderProductThumb = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

export type CustomerOrderRow = {
  id: string;
  orderRef: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  shippingLine: string | null;
  products: CustomerOrderProductThumb[];
};

type CustomerOrdersListProps = {
  orders: CustomerOrderRow[];
};

export function CustomerOrdersList({ orders }: CustomerOrdersListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpanded(orderId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white divide-y divide-gray-3">
      {orders.map((o) => {
        const expanded = expandedIds.has(o.id);
        return (
          <Fragment key={o.id}>
            <div className="flex items-stretch gap-2 p-4 sm:p-6 hover:bg-gray-1 transition">
              <div className="flex shrink-0 items-start pt-0.5">
                <button
                  type="button"
                  onClick={() => toggleExpanded(o.id)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Hide" : "Show"} products in order ${o.orderRef}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-3 text-meta-3 hover:border-blue hover:text-blue"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                    className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <Link href={`/orders/${o.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-meta-3">Order</div>
                    <div className="font-semibold text-dark">{o.orderRef}</div>
                    {o.shippingLine ? (
                      <div className="mt-1 text-xs text-meta-3 line-clamp-1">{o.shippingLine}</div>
                    ) : null}
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Total</div>
                    <div className="font-semibold text-dark">{formatPrice(o.totalAmount)}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Status</div>
                    <div className="font-semibold text-dark">{o.status}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-meta-3">Payment</div>
                    <div className="font-semibold text-dark">{o.paymentStatus}</div>
                  </div>
                </div>
              </Link>
            </div>
            {expanded ? (
              <div className="border-t border-gray-3 bg-gray-1/60 px-4 py-3 sm:px-6">
                {o.products.length > 0 ? (
                  <div className="flex flex-wrap items-start gap-3 pl-9">
                    {o.products.map((product) => (
                      <Link
                        key={product.productId}
                        href={`/shop/${product.slug}`}
                        title={product.name}
                        className="group relative shrink-0 rounded-lg border border-transparent p-1 transition hover:border-gray-3 hover:bg-white"
                      >
                        <AdminProductThumbnail
                          url={product.imageUrl}
                          alt={productImageAlt(product.name)}
                          size={56}
                        />
                        {product.quantity > 1 ? (
                          <span className="absolute -right-1 -top-1 rounded-full bg-dark px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            ×{product.quantity}
                          </span>
                        ) : null}
                        <span className="mt-1 block max-w-[72px] truncate text-center text-[10px] text-meta-3 group-hover:text-blue">
                          {product.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="pl-9 text-sm text-meta-3">No product thumbnails for this order.</p>
                )}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
