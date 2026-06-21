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
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/ga4/formatters";
import { CHANNEL_COLORS, CHART_COLORS } from "@/lib/ga4/types";
import type { TrafficAcquisitionData } from "@/lib/ga4/types";

type Props = {
  data: TrafficAcquisitionData | null;
  loading: boolean;
  error: string | null;
};

function channelColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? CHART_COLORS.slate;
}

export default function TrafficAcquisition({ data, loading, error }: Props) {
  if (loading) {
    return (
      <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
    );
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
    name: row.channel,
    value: row.sessions,
    fill: channelColor(row.channel),
  }));

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Sessions</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Conv. Rate</th>
              <th className="px-4 py-3">% of total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.channel} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: channelColor(row.channel) }}
                  />
                  {row.channel}
                </td>
                <td className="px-4 py-3">{formatNumber(row.users)}</td>
                <td className="px-4 py-3">{formatNumber(row.sessions)}</td>
                <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                <td className="px-4 py-3">{formatPercent(row.conversionRate)}</td>
                <td className="px-4 py-3">{formatPercent(row.percentOfSessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartWrapper title="Sessions by channel">
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

        <ChartWrapper title="Revenue by channel">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rows}>
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {data.rows.map((row) => (
                    <Cell key={row.channel} fill={channelColor(row.channel)} />
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
