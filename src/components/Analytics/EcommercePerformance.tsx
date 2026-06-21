"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartWrapper from "./ChartWrapper";
import MetricCard from "./MetricCard";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/ga4/formatters";
import { CHART_COLORS } from "@/lib/ga4/types";
import type { EcommercePerformanceData } from "@/lib/ga4/types";

type Props = {
  data: EcommercePerformanceData | null;
  loading: boolean;
  error: string | null;
};

export default function EcommercePerformance({ data, loading, error }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Orders" value={data.transactions} formatter={formatNumber} />
        <MetricCard label="Revenue" value={data.purchaseRevenue} formatter={formatCurrency} />
        <MetricCard label="Conv. Rate" value={data.conversionRate} formatter={formatPercent} />
        <MetricCard label="AOV" value={data.averagePurchaseRevenue} formatter={formatCurrency} />
      </div>

      <ChartWrapper title="Daily revenue trend">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartWrapper>

      <ChartWrapper title="Best sellers">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((product) => (
                <tr key={`${product.rank}-${product.name}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{product.rank}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{product.name}</td>
                  <td className="px-3 py-2">{product.category}</td>
                  <td className="px-3 py-2">{formatCurrency(product.revenue)}</td>
                  <td className="px-3 py-2">{formatNumber(product.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartWrapper>
    </div>
  );
}
