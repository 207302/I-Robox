"use client";

import { useMemo, useState } from "react";
import {
  formatDuration,
  formatNumber,
} from "@/lib/ga4/formatters";
import type { BehaviourRow, UserBehaviourData } from "@/lib/ga4/types";

type Props = {
  data: UserBehaviourData | null;
  loading: boolean;
  error: string | null;
};

type SortKey = keyof BehaviourRow;
const PAGE_SIZE = 10;

export default function UserBehaviour({ data, loading, error }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("pageViews");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.rows].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === "string" && typeof right === "string") {
        return sortDir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }
      return sortDir === "asc"
        ? Number(left) - Number(right)
        : Number(right) - Number(left);
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    { key: "pagePath", label: "Page Path" },
    { key: "pageViews", label: "Page Views" },
    { key: "avgTime", label: "Avg Engagement" },
    { key: "users", label: "Users" },
  ];

  return (
    <div className="space-y-4">
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
              <tr key={row.pagePath} className="border-b border-slate-100 dark:border-slate-800">
                <td className="max-w-md truncate px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {row.pagePath}
                </td>
                <td className="px-4 py-3">{formatNumber(row.pageViews)}</td>
                <td className="px-4 py-3">{formatDuration(row.avgTime)}</td>
                <td className="px-4 py-3">{formatNumber(row.users)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Page {page} of {totalPages}
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
