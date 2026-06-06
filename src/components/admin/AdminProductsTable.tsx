"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { formatPrice } from "@/utils/formatePrice";
import { filterAndSortProducts } from "@/lib/search/productSearch";
import type { ProductSearchItem as AdminProductSearchItem } from "@/lib/search/productSearch";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminProductThumbnail } from "@/components/admin/AdminProductThumbnail";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";

const PAGE_SIZE = 50;
const MAX_BULK_DELETE = 50;

type AdminProductsTableProps = {
  products: AdminProductSearchItem[];
};

export function AdminProductsTable({ products }: AdminProductsTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searching = query !== deferredQuery;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const pagedIds = useMemo(() => paged.map((p) => p.id), [paged]);
  const allOnPageSelected =
    paged.length > 0 && pagedIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pagedIds.some((id) => selectedIds.has(id));

  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (safePage - 1) * PAGE_SIZE + paged.length;

  const selectedCount = selectedIds.size;

  function onQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function clearSearch() {
    setQuery("");
    setPage(1);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pagedIds) next.delete(id);
      } else {
        for (const id of pagedIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (ids.length > MAX_BULK_DELETE) {
      toast.error(`Select at most ${MAX_BULK_DELETE} products at a time`);
      return;
    }

    const names = products
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.name)
      .slice(0, 5);
    const preview =
      names.length > 0
        ? `\n\n${names.join("\n")}${ids.length > 5 ? `\n…and ${ids.length - 5} more` : ""}`
        : "";

    const ok = window.confirm(
      `Delete ${ids.length} product${ids.length === 1 ? "" : "s"}? This cannot be undone. Products with orders or reviews will be skipped.${preview}`
    );
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await fetchAdminWithRetry("/api/admin/products/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && data?.code === "TIMEOUT") {
          throw new Error("Bulk delete timed out — try fewer products or retry in a moment");
        }
        throw new Error(data?.error || "Bulk delete failed");
      }

      const deleted = (data.deleted ?? []) as string[];
      const deletedCount = Number(data.deletedCount ?? deleted.length);
      const failed = (data.failed ?? []) as { id: string; name?: string | null; error: string }[];

      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} product${deletedCount === 1 ? "" : "s"}`);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of deleted) next.delete(id);
          return next;
        });
      }

      if (failed.length > 0) {
        const skippedNames = failed
          .map((f) => f.name ?? products.find((p) => p.id === f.id)?.name ?? f.id)
          .slice(0, 5);
        const suffix = failed.length > 5 ? `, +${failed.length - 5} more` : "";
        toast.error(
          `${failed.length} skipped (have orders/reviews): ${skippedNames.join(", ")}${suffix}`,
          { duration: 8000 }
        );
      }

      if (deletedCount === 0 && failed.length === 0) {
        clearSelection();
      }

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

        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-meta-3">{selectedCount} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-sm font-medium text-meta-3 hover:text-blue"
            >
              Clear selection
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={() => void handleBulkDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {bulkDeleting ? "Deleting…" : `Delete selected (${selectedCount})`}
            </button>
          </div>
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
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                  }}
                  onChange={togglePage}
                  disabled={paged.length === 0 || bulkDeleting}
                  className="h-4 w-4 rounded border-gray-3"
                />
              </th>
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
              <tr
                key={p.id}
                className={`border-b border-gray-3 ${selectedIds.has(p.id) ? "bg-blue/5" : ""}`}
              >
                <td className="py-3 px-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    disabled={bulkDeleting}
                    className="h-4 w-4 rounded border-gray-3"
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <AdminProductThumbnail url={p.imageUrl} alt={p.name} />
                    <div className="min-w-0">
                      <div className="font-semibold text-dark truncate">{p.name}</div>
                      <div className="text-xs text-meta-4 truncate">{p.slug}</div>
                    </div>
                  </div>
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
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={7}>
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
