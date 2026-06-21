"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/ga4/formatters";
import type { LandingPageAnalysisData, LandingPageRow } from "@/lib/ga4/types";

type Props = {
  data: LandingPageAnalysisData | null;
  loading: boolean;
  error: string | null;
};

type SortKey = keyof Pick<
  LandingPageRow,
  "page" | "users" | "sessions" | "engagementRate" | "conversions" | "revenue"
>;

const PAGE_SIZE = 10;

export default function LandingPageAnalysis({ data, loading, error }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    const rows = query
      ? data.rows.filter((row) => row.page.toLowerCase().includes(query))
      : data.rows;

    return [...rows].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === "string" && typeof right === "string") {
        return sortDir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }
      const numLeft = Number(left);
      const numRight = Number(right);
      return sortDir === "asc" ? numLeft - numRight : numRight - numLeft;
    });
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (loading) {
    return <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const columns: { key: SortKey; label: string }[] = [
    { key: "page", label: "Page" },
    { key: "users", label: "Users" },
    { key: "sessions", label: "Sessions" },
    { key: "engagementRate", label: "Engagement Rate" },
    { key: "conversions", label: "Conversions" },
    { key: "revenue", label: "Revenue" },
  ];

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Filter pages…"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="font-medium hover:text-slate-900 dark:hover:text-white"
                  >
                    {column.label}
                    {sortKey === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.page} className="border-b border-slate-100 dark:border-slate-800">
                <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {row.page}
                </td>
                <td className="px-4 py-3">{formatNumber(row.users)}</td>
                <td className="px-4 py-3">{formatNumber(row.sessions)}</td>
                <td className="px-4 py-3">{formatPercent(row.engagementRate)}</td>
                <td className="px-4 py-3">{formatNumber(row.conversions)}</td>
                <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Page {page} of {totalPages} ({filtered.length} rows)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-slate-600"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-slate-600"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
