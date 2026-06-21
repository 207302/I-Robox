"use client";

import MetricCard from "./MetricCard";
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/ga4/formatters";
import type { ExecutiveSummaryData } from "@/lib/ga4/types";

type Props = {
  data: ExecutiveSummaryData | null;
  loading: boolean;
  error: string | null;
};

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

export default function ExecutiveSummary({ data, loading, error }: Props) {
  if (loading) return <SkeletonGrid />;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { current, previous } = data;
  const aov =
    current.averagePurchaseRevenue > 0
      ? current.averagePurchaseRevenue
      : current.transactions > 0
        ? current.purchaseRevenue / current.transactions
        : 0;
  const prevAov =
    previous.averagePurchaseRevenue > 0
      ? previous.averagePurchaseRevenue
      : previous.transactions > 0
        ? previous.purchaseRevenue / previous.transactions
        : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <MetricCard label="Total Users" value={current.totalUsers} previousValue={previous.totalUsers} formatter={formatNumber} />
      <MetricCard label="New Users" value={current.newUsers} previousValue={previous.newUsers} formatter={formatNumber} />
      <MetricCard label="Sessions" value={current.sessions} previousValue={previous.sessions} formatter={formatNumber} />
      <MetricCard label="Engaged Sessions" value={current.engagedSessions} previousValue={previous.engagedSessions} formatter={formatNumber} />
      <MetricCard label="Avg Engagement Time" value={current.averageSessionDuration} previousValue={previous.averageSessionDuration} formatter={formatDuration} />
      <MetricCard label="Revenue" value={current.purchaseRevenue} previousValue={previous.purchaseRevenue} formatter={formatCurrency} />
      <MetricCard label="Transactions" value={current.transactions} previousValue={previous.transactions} formatter={formatNumber} />
      <MetricCard label="Conversion Rate" value={current.conversionRate} previousValue={previous.conversionRate} formatter={formatPercent} />
      <MetricCard label="AOV" value={aov} previousValue={prevAov} formatter={formatCurrency} />
    </div>
  );
}
