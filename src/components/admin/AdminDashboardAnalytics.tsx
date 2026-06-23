"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/ga4/formatters";
import type { ExecutiveSummaryData, RealtimeUsersData } from "@/lib/ga4/types";

type Props = {
  ga4Configured: boolean;
};

const POLL_MS = 30_000;

export default function AdminDashboardAnalytics({ ga4Configured }: Props) {
  const [realtime, setRealtime] = useState<RealtimeUsersData | null>(null);
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingRealtime, setLoadingRealtime] = useState(ga4Configured);
  const [loadingSummary, setLoadingSummary] = useState(ga4Configured);

  useEffect(() => {
    if (!ga4Configured) return;

    let cancelled = false;

    async function loadRealtime() {
      try {
        const res = await fetch("/api/admin/analytics/realtime");
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setRealtimeError(json?.error || "Could not load live users");
          return;
        }
        setRealtime(json.data ?? null);
        setRealtimeError(null);
      } catch {
        if (!cancelled) setRealtimeError("Could not load live users");
      } finally {
        if (!cancelled) setLoadingRealtime(false);
      }
    }

    async function loadSummary() {
      try {
        const res = await fetch("/api/admin/analytics/summary");
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSummaryError(json?.error || "Could not load site analytics");
          return;
        }
        setSummary(json.data ?? null);
        setSummaryError(null);
      } catch {
        if (!cancelled) setSummaryError("Could not load site analytics");
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    }

    void loadRealtime();
    void loadSummary();

    const timer = window.setInterval(() => {
      void loadRealtime();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ga4Configured]);

  if (!ga4Configured) {
    return (
      <div className="rounded-2xl border border-gray-3 bg-white p-5">
        <h2 className="text-lg font-semibold text-dark">Site traffic</h2>
        <p className="mt-2 text-sm text-meta-3">
          Connect Google Analytics 4 to see live visitors and traffic on this dashboard. Set{" "}
          <code className="text-xs">GA4_PROPERTY_ID</code> and either{" "}
          <code className="text-xs">GA4_SERVICE_ACCOUNT_JSON</code> (full JSON file) or{" "}
          <code className="text-xs">GA4_CLIENT_EMAIL</code> +{" "}
          <code className="text-xs">GA4_PRIVATE_KEY</code> in your environment.
        </p>
      </div>
    );
  }

  const current = summary?.current;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-dark">Site traffic</h2>
        <Link href="/analytics" className="text-sm font-medium text-blue hover:underline">
          Open full GA4 dashboard →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Live users
          </div>
          {loadingRealtime && !realtime ? (
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-emerald-100" />
          ) : realtimeError ? (
            <p className="mt-2 text-sm text-emerald-800">{realtimeError}</p>
          ) : (
            <>
              <div className="mt-2 text-3xl font-semibold text-emerald-900">
                {formatNumber(realtime?.activeUsers ?? 0)}
              </div>
              <p className="mt-1 text-xs text-emerald-700">Active on site now (GA4 realtime)</p>
            </>
          )}
        </div>

        <StatCard
          label="Users (7 days)"
          value={current ? formatNumber(current.totalUsers) : "—"}
          loading={loadingSummary && !current}
          error={summaryError}
        />
        <StatCard
          label="Sessions (7 days)"
          value={current ? formatNumber(current.sessions) : "—"}
          loading={loadingSummary && !current}
          error={summaryError}
        />
        <StatCard
          label="Revenue (7 days)"
          value={current ? formatCurrency(current.purchaseRevenue) : "—"}
          loading={loadingSummary && !current}
          error={summaryError}
        />
        <StatCard
          label="Orders (7 days)"
          value={current ? formatNumber(current.transactions) : "—"}
          loading={loadingSummary && !current}
          error={summaryError}
        />
      </div>

      {summaryError && !current ? (
        <p className="text-sm text-meta-3">{summaryError}</p>
      ) : (
        <p className="text-xs text-meta-3">
          Live count refreshes every 30 seconds. 7-day stats come from Google Analytics (same data as the{" "}
          <Link href="/analytics" className="text-blue hover:underline">
            analytics dashboard
          </Link>
          ).
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  error,
}: {
  label: string;
  value: string;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-5">
      <div className="text-sm text-meta-3">{label}</div>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-gray-100" />
      ) : error && value === "—" ? (
        <div className="mt-2 text-sm text-meta-3">—</div>
      ) : (
        <div className="mt-2 text-2xl font-semibold text-dark">{value}</div>
      )}
    </div>
  );
}
