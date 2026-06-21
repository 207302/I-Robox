"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
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
import type { DeviceData } from "@/lib/ga4/types";

type Props = {
  data: DeviceData | null;
  loading: boolean;
  error: string | null;
};

const DEVICE_COLORS: Record<string, string> = {
  desktop: CHART_COLORS.primary,
  mobile: CHART_COLORS.secondary,
  tablet: CHART_COLORS.tertiary,
};

function deviceColor(device: string): string {
  return DEVICE_COLORS[device.toLowerCase()] ?? CHART_COLORS.slate;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function DeviceAnalysis({ data, loading, error }: Props) {
  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        {error}
      </div>
    );
  }
  if (!data || data.rows.length === 0) return null;

  const pieData = data.rows.map((row) => ({
    name: capitalize(row.device),
    value: row.sessions,
    fill: deviceColor(row.device),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {data.rows.map((row) => (
          <div
            key={row.device}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {capitalize(row.device)}
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetricCard label="Users" value={row.users} formatter={formatNumber} />
              <MetricCard label="Sessions" value={row.sessions} formatter={formatNumber} />
              <MetricCard label="Conv. Rate" value={row.conversionRate} formatter={formatPercent} />
              <MetricCard label="Revenue" value={row.revenue} formatter={formatCurrency} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartWrapper title="Sessions by device">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatNumber(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>

        <ChartWrapper title="Conversion rate by device">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rows}>
                <XAxis dataKey="device" tickFormatter={capitalize} />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value: number) => formatPercent(value)} />
                <Bar dataKey="conversionRate" radius={[4, 4, 0, 0]}>
                  {data.rows.map((row) => (
                    <Cell key={row.device} fill={deviceColor(row.device)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>
      </div>
    </div>
  );
}
