"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/utils/formatePrice";
import { filterAndSortProducts } from "@/lib/search/productSearch";
import type { ProductSearchItem as AdminProductSearchItem } from "@/lib/search/productSearch";
import { AdminPagination } from "@/components/admin/AdminPagination";

const PAGE_SIZE = 50;

type AdminProductsTableProps = {
  products: AdminProductSearchItem[];
};

export function AdminProductsTable({ products }: AdminProductsTableProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searching = query !== deferredQuery;

  const filtered = useMemo(
    () => filterAndSortProducts(products, deferredQuery),
    [products, deferredQuery]
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
          aria-label="Search products"
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

      {total > 0 ? (
        <p className={`text-sm text-meta-3 ${searching ? "opacity-60" : ""}`}>
          {q
            ? `Found ${total} match${total !== 1 ? "es" : ""}`
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          {totalPages > 1 ? ` · Page ${safePage} of ${totalPages}` : null}
        </p>
      ) : q ? (
        <p className="text-sm text-meta-3">No products match &quot;{q}&quot;.</p>
      ) : null}

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Brand / taxonomy</th>
              <th className="py-3 px-4">Scale</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Active</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr key={p.id} className="border-b border-gray-3">
                <td className="py-3 px-4">
                  <div className="font-semibold text-dark">{p.name}</div>
                  <div className="text-xs text-meta-4">{p.slug}</div>
                </td>
                <td className="py-3 px-4 text-xs text-meta-3">
                  <div>{p.brand ?? "—"}</div>
                  {(p.category || p.subcategory) && (
                    <div className="text-meta-4">
                      {[p.category, p.subcategory].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-meta-3 text-sm">{p.scale ?? "—"}</td>
                <td className="py-3 px-4 text-dark">
                  {formatPrice(Number(p.discountedPrice ?? p.basePrice))}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-xs rounded-full border px-3 py-1 ${
                      p.isActive
                        ? "bg-gray-1 border-gray-3 text-dark"
                        : "bg-white border-gray-3 text-meta-3"
                    }`}
                  >
                    {p.isActive ? "Yes" : "No"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="text-sm font-medium text-blue hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {paged.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={6}>
                  {q ? "No matching products." : "No products yet."}
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
          pathname="/admin/products"
          onPageChange={setPage}
        />
      ) : null}
    </>
  );
}
