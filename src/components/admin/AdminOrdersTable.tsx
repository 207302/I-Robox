"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, Fragment } from "react";
import toast from "react-hot-toast";
import { formatPrice } from "@/utils/formatePrice";
import { AdminBulkDeleteBar } from "@/components/admin/AdminBulkDeleteBar";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminProductThumbnail } from "@/components/admin/AdminProductThumbnail";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";
import { useBulkSelection } from "@/components/admin/useBulkSelection";

const PAGE_SIZE = 50;
const MAX_BULK_DELETE = 50;
const TABLE_COL_COUNT = 7;

export type AdminOrderProductThumb = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  orderId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAtLabel: string;
  customerName: string | null;
  customerEmail: string | null;
  productNames: string;
  products: AdminOrderProductThumb[];
};

type AdminOrdersTableProps = {
  orders: AdminOrderRow[];
  canDelete?: boolean;
};

function filterOrders(rows: AdminOrderRow[], query: string): AdminOrderRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((o) => {
    const hay = [
      o.orderId,
      o.orderNumber,
      o.id,
      o.status,
      o.paymentStatus,
      o.customerEmail ?? "guest",
      o.productNames,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function AdminOrdersTable({ orders, canDelete = false }: AdminOrdersTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searching = query !== deferredQuery;
  const bulk = useBulkSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const tableColSpan = TABLE_COL_COUNT + (canDelete ? 1 : 0);

  function toggleExpanded(orderId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const filtered = useMemo(
    () => filterOrders(orders, deferredQuery),
    [orders, deferredQuery]
  );

  const [page, setPage] = useState(1);
  const q = deferredQuery.trim();

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const skip = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(skip, skip + PAGE_SIZE);
  }, [filtered, safePage]);

  const pagedIds = useMemo(() => paged.map((o) => o.id), [paged]);
  const { allOnPageSelected, someOnPageSelected } = bulk.selectionForPage(pagedIds);

  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (safePage - 1) * PAGE_SIZE + paged.length;

  function onQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function clearSearch() {
    setQuery("");
    setPage(1);
  }

  async function handleBulkDelete() {
    const ids = bulk.selectedArray;
    if (ids.length === 0) return;
    if (ids.length > MAX_BULK_DELETE) {
      toast.error(`Select at most ${MAX_BULK_DELETE} orders at a time`);
      return;
    }

    const preview = orders
      .filter((o) => bulk.isSelected(o.id))
      .map((o) => o.orderId)
      .slice(0, 3)
      .join("\n");
    const ok = window.confirm(
      `Permanently delete ${ids.length} order${ids.length === 1 ? "" : "s"}? Stock will be restored where possible. This cannot be undone.\n\n${preview}${ids.length > 3 ? `\n…and ${ids.length - 3} more` : ""}`
    );
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await fetchAdminWithRetry("/api/admin/orders/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Bulk delete failed");

      const deletedCount = Number(data.deletedCount ?? 0);
      const failed = (data.failed ?? []) as { id: string; error: string }[];

      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} order${deletedCount === 1 ? "" : "s"}`);
      }
      if (failed.length > 0) {
        const first = failed[0];
        toast.error(
          `${failed.length} could not be deleted (e.g. ${first.id}: ${first.error})`,
          { duration: 6000 }
        );
      }

      bulk.clearSelection();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 sm:mx-0">
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search order id, name, email, product, status…"
            aria-label="Search orders"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-blue"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={clearSearch}
              className="shrink-0 text-sm font-medium text-meta-3 hover:text-blue"
            >
              Clear
            </button>
          ) : null}
        </div>

        {canDelete ? (
          <AdminBulkDeleteBar
            selectedCount={bulk.selectedCount}
            deleting={bulkDeleting}
            itemLabel="order"
            onClear={bulk.clearSelection}
            onDelete={() => void handleBulkDelete()}
          />
        ) : null}
      </div>

      {total > 0 ? (
        <p className={`text-sm text-meta-3 ${searching ? "opacity-60" : ""}`}>
          {q
            ? `Found ${total} match${total !== 1 ? "es" : ""}`
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          {totalPages > 1 ? ` · Page ${safePage} of ${totalPages}` : null}
        </p>
      ) : q ? (
        <p className="text-sm text-meta-3">No orders match &quot;{q}&quot;.</p>
      ) : null}

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-2 w-10" aria-hidden />
              {canDelete ? (
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                    }}
                    onChange={() => bulk.toggleMany(pagedIds, !allOnPageSelected)}
                    disabled={paged.length === 0 || bulkDeleting}
                    className="h-4 w-4 rounded border-gray-3"
                  />
                </th>
              ) : null}
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((o) => {
              const expanded = expandedIds.has(o.id);
              return (
                <Fragment key={o.id}>
                  <tr
                    className={`border-b border-gray-3 ${bulk.isSelected(o.id) ? "bg-blue/5" : ""}`}
                  >
                    <td className="py-3 px-2 align-middle">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(o.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} products in order ${o.orderId}`}
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
                    </td>
                    {canDelete ? (
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Select order ${o.id}`}
                          checked={bulk.isSelected(o.id)}
                          onChange={() => bulk.toggleOne(o.id)}
                          disabled={bulkDeleting}
                          className="h-4 w-4 rounded border-gray-3"
                        />
                      </td>
                    ) : null}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-dark font-mono tracking-wide">{o.orderId}</div>
                      <div className="text-xs text-meta-4">{o.createdAtLabel}</div>
                    </td>
                    <td className="py-3 px-4 text-dark">
                      <div className="font-medium">{o.customerName ?? "Guest"}</div>
                      {o.customerEmail ? (
                        <div className="text-xs text-meta-4 break-all">{o.customerEmail}</div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-dark">{o.status}</td>
                    <td className="py-3 px-4 text-dark">{o.paymentStatus}</td>
                    <td className="py-3 px-4 text-dark">{formatPrice(o.totalAmount)}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-sm font-medium text-blue hover:underline"
                      >
                        View / update
                      </Link>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-gray-3 bg-gray-1/60">
                      <td colSpan={tableColSpan} className="px-4 py-3">
                        {o.products.length > 0 ? (
                          <div className="flex flex-wrap items-start gap-3 pl-1">
                            {o.products.map((product) => (
                              <Link
                                key={product.productId}
                                href={`/shop/${product.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={product.name}
                                className="group relative shrink-0 rounded-lg border border-transparent p-1 transition hover:border-gray-3 hover:bg-white"
                              >
                                <AdminProductThumbnail
                                  url={product.imageUrl}
                                  alt={product.name}
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
                          <p className="text-sm text-meta-3">No product thumbnails for this order.</p>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {paged.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={tableColSpan}>
                  {q ? "No matching orders." : "No orders yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <AdminPagination
          currentPage={safePage}
          totalPages={totalPages}
          pathname="/admin/orders"
          onPageChange={setPage}
        />
      ) : null}
    </>
  );
}
