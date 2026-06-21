"use client";

import {
  formatCurrency,
  formatNumber,
  countryCodeToFlag,
} from "@/lib/ga4/formatters";
import type { GeographicData } from "@/lib/ga4/types";

type Props = {
  data: GeographicData | null;
  loading: boolean;
  error: string | null;
};

export default function GeographicAnalysis({ data, loading, error }: Props) {
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
  if (!data || data.rows.length === 0) return null;

  const maxUsers = Math.max(...data.rows.map((row) => row.users), 1);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Country</th>
            <th className="px-4 py-3">City</th>
            <th className="px-4 py-3">Users</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Transactions</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={`${row.country}-${row.city}-${row.rank}`} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">{row.rank}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                  <span>{countryCodeToFlag(row.countryCode)}</span>
                  <span>{row.country}</span>
                </div>
                <div
                  className="mt-2 h-1.5 rounded-full bg-blue-500/80"
                  style={{ width: `${Math.max(8, (row.users / maxUsers) * 100)}%` }}
                />
              </td>
              <td className="px-4 py-3">{row.city}</td>
              <td className="px-4 py-3">{formatNumber(row.users)}</td>
              <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
              <td className="px-4 py-3">{formatNumber(row.transactions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
