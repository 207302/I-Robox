"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { filterAndSortProducts } from "@/lib/search/productSearch";
import type { ProductSearchItem } from "@/lib/search/productSearch";
import { AdminPagination } from "@/components/admin/AdminPagination";

const PAGE_SIZE = 50;

export type AdminInventoryRow = {
  id: string;
  productId: string;
  productVariantId: string | null;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  lowStockThreshold: number;
  pending: boolean;
  isActive: boolean;
  search: ProductSearchItem;
};

function filterAndSortInventoryRows(rows: AdminInventoryRow[], query: string): AdminInventoryRow[] {
  const q = query.trim();
  if (!q) return rows;

  const sorted = filterAndSortProducts(
    rows.map((r) => r.search),
    q
  );
  const order = new Map(sorted.map((s, i) => [s.id, i]));
  const ids = new Set(sorted.map((s) => s.id));

  return rows
    .filter((r) => ids.has(r.productId))
    .sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
}

function isBelowThreshold(available: number, threshold: number) {
  return available === 0 || available < threshold;
}

type AdminInventoryTableProps = {
  rows: AdminInventoryRow[];
};

export function AdminInventoryTable({ rows }: AdminInventoryTableProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searching = query !== deferredQuery;

  const filtered = useMemo(
    () => filterAndSortInventoryRows(rows, deferredQuery),
    [rows, deferredQuery]
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

  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (safePage - 1) * PAGE_SIZE + paged.length;

  const lowStock = useMemo(
    () => rows.filter((r) => isBelowThreshold(r.availableQuantity, r.lowStockThreshold)),
    [rows]
  );
  const outOfStock = useMemo(() => rows.filter((r) => r.availableQuantity === 0), [rows]);

  function onQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function clearSearch() {
    setQuery("");
    setPage(1);
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-md items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, brand, category, SKU…"
          aria-label="Search inventory"
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

      {outOfStock.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
          <p className="font-semibold">
            🚫 {outOfStock.length} line{outOfStock.length !== 1 ? "s" : ""} out of stock
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {outOfStock.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.pending ? `/admin/products/${r.productId}` : `/admin/inventory/${r.id}`}
                  className="underline hover:no-underline"
                >
                  {r.search.name}
                  {r.search.sku ? ` (${r.search.sku})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lowStock.length > 0 && outOfStock.length < lowStock.length && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
          <p className="font-semibold">
            ⚠️ {lowStock.length} line{lowStock.length !== 1 ? "s" : ""} below low-stock threshold
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {lowStock
              .filter((r) => r.availableQuantity > 0)
              .map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.pending ? `/admin/products/${r.productId}` : `/admin/inventory/${r.id}`}
                    className="underline hover:no-underline"
                  >
                    {r.search.name}
                    {r.search.sku ? ` (${r.search.sku})` : ""}
                  </Link>{" "}
                  — {r.availableQuantity} left (threshold: {r.lowStockThreshold})
                </li>
              ))}
          </ul>
        </div>
      )}

      {lowStock.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Nothing is below its low-stock threshold.
        </div>
      )}

      {total > 0 ? (
        <p className={`text-sm text-meta-3 ${searching ? "opacity-60" : ""}`}>
          {q
            ? `Found ${total} match${total !== 1 ? "es" : ""}`
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          {totalPages > 1 ? ` · Page ${safePage} of ${totalPages}` : null}
        </p>
      ) : q ? (
        <p className="text-sm text-meta-3">No inventory rows match &quot;{q}&quot;.</p>
      ) : null}

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Store</th>
              <th className="py-3 px-4">Available</th>
              <th className="py-3 px-4">Reserved</th>
              <th className="py-3 px-4">Sold</th>
              <th className="py-3 px-4">Threshold</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Edit</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const isRed = isBelowThreshold(r.availableQuantity, r.lowStockThreshold);
              const isOut = r.availableQuantity === 0;
              return (
                <tr key={r.id} className={`border-b border-gray-3 ${isRed ? "bg-red-50" : ""}`}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-dark">{r.search.name}</div>
                    <div className="text-xs text-meta-4">{r.search.sku ?? ""}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs rounded-full border px-3 py-1 ${
                        r.isActive
                          ? "bg-gray-1 border-gray-3 text-dark"
                          : "bg-white border-gray-3 text-meta-3"
                      }`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={`py-3 px-4 font-semibold ${isRed ? "text-red-600" : "text-dark"}`}>
                    {r.availableQuantity}
                  </td>
                  <td className={`py-3 px-4 ${isRed ? "text-red-700/90" : "text-dark"}`}>
                    {r.reservedQuantity}
                  </td>
                  <td className={`py-3 px-4 ${isRed ? "text-red-700/90" : "text-dark"}`}>
                    {r.soldQuantity}
                  </td>
                  <td className={`py-3 px-4 ${isRed ? "text-red-700/90" : "text-dark"}`}>
                    {r.lowStockThreshold}
                  </td>
                  <td className="py-3 px-4">
                    {isOut ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Out of stock
                      </span>
                    ) : isRed ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Below threshold
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      className="text-sm font-medium text-blue hover:underline"
                      href={r.pending ? `/admin/products/${r.productId}` : `/admin/inventory/${r.id}`}
                    >
                      {r.pending ? "Set stock" : "Edit"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={8}>
                  {q ? "No matching inventory rows." : "No inventory rows found."}
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
          pathname="/admin/inventory"
          onPageChange={setPage}
        />
      ) : null}
    </>
  );
}
