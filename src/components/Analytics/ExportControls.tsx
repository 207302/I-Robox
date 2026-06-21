"use client";

import type { DashboardExportData } from "@/lib/ga4/types";

type ExportControlsProps = {
  exportData: DashboardExportData;
};

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(exportData: DashboardExportData): string {
  const lines: string[] = [];
  const { dateRange } = exportData;

  lines.push(`i-robox GA4 Analytics Export`);
  lines.push(`Period,${dateRange.startDate} to ${dateRange.endDate}`);
  lines.push("");

  if (exportData.summary) {
    lines.push("Executive Summary");
    lines.push("Metric,Current,Previous");
    const { current, previous } = exportData.summary;
    lines.push(`Total Users,${current.totalUsers},${previous.totalUsers}`);
    lines.push(`New Users,${current.newUsers},${previous.newUsers}`);
    lines.push(`Sessions,${current.sessions},${previous.sessions}`);
    lines.push(`Engaged Sessions,${current.engagedSessions},${previous.engagedSessions}`);
    lines.push(`Revenue,${current.purchaseRevenue},${previous.purchaseRevenue}`);
    lines.push(`Transactions,${current.transactions},${previous.transactions}`);
    lines.push("");
  }

  if (exportData.traffic) {
    lines.push("Traffic Acquisition");
    lines.push("Channel,Users,Sessions,Revenue,Conversion Rate,% of Sessions");
    exportData.traffic.rows.forEach((row) => {
      lines.push(
        [
          escapeCsv(row.channel),
          row.users,
          row.sessions,
          row.revenue,
          row.conversionRate,
          row.percentOfSessions,
        ].join(",")
      );
    });
    lines.push("");
  }

  if (exportData.ecommerce) {
    lines.push("Top Products");
    lines.push("Rank,Product,Category,Revenue,Quantity");
    exportData.ecommerce.topProducts.forEach((row) => {
      lines.push(
        [row.rank, escapeCsv(row.name), escapeCsv(row.category), row.revenue, row.quantity].join(",")
      );
    });
    lines.push("");
  }

  if (exportData.pages) {
    lines.push("Landing Pages");
    lines.push("Page,Users,Sessions,Engagement Rate,Conversions,Revenue");
    exportData.pages.rows.forEach((row) => {
      lines.push(
        [
          escapeCsv(row.page),
          row.users,
          row.sessions,
          row.engagementRate,
          row.conversions,
          row.revenue,
        ].join(",")
      );
    });
    lines.push("");
  }

  if (exportData.geo) {
    lines.push("Geography");
    lines.push("Rank,Country,City,Users,Revenue,Transactions");
    exportData.geo.rows.forEach((row) => {
      lines.push(
        [row.rank, escapeCsv(row.country), escapeCsv(row.city), row.users, row.revenue, row.transactions].join(",")
      );
    });
    lines.push("");
  }

  if (exportData.devices) {
    lines.push("Devices");
    lines.push("Device,Users,Sessions,Conversion Rate,Revenue");
    exportData.devices.rows.forEach((row) => {
      lines.push(
        [escapeCsv(row.device), row.users, row.sessions, row.conversionRate, row.revenue].join(",")
      );
    });
    lines.push("");
  }

  if (exportData.behaviour) {
    lines.push("User Behaviour");
    lines.push("Page Path,Page Views,Avg Time,Exit Rate,Users");
    exportData.behaviour.rows.forEach((row) => {
      lines.push(
        [
          escapeCsv(row.pagePath),
          row.pageViews,
          row.avgTime,
          row.exitRate,
          row.users,
        ].join(",")
      );
    });
  }

  return lines.join("\n");
}

export default function ExportControls({ exportData }: ExportControlsProps) {
  function handleCsvExport() {
    const csv = buildCsv(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `irobox-ga4-${exportData.dateRange.startDate}-${exportData.dateRange.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={handleCsvExport}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Print
      </button>
    </div>
  );
}
