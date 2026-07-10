"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/ga4/formatters";
import type { ExecutiveSummaryData, RealtimeUsersData } from "@/lib/ga4/types";

type Props = {
  ga4Configured: boolean;
  ga4ConfigHint?: string | null;
};

const REALTIME_POLL_MS = 3_000;

type QuickSummary = Pick<ExecutiveSummaryData, "current">;

function LiveUserCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [pulse, setPulse] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    setDisplay(value);
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 450);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div
      className={`mt-2 text-3xl font-semibold text-emerald-900 tabular-nums transition-transform duration-300 ease-out ${
        pulse ? "scale-110" : "scale-100"
      }`}
    >
      {formatNumber(display)}
    </div>
  );
}

export default function AdminDashboardAnalytics({ ga4Configured, ga4ConfigHint }: Props) {
  const [realtime, setRealtime] = useState<RealtimeUsersData | null>(null);
  const [summary, setSummary] = useState<QuickSummary | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingRealtime, setLoadingRealtime] = useState(ga4Configured);
  const [loadingSummary, setLoadingSummary] = useState(ga4Configured);

  const [configDiag, setConfigDiag] = useState<{
    hasPropertyId: boolean;
    hasJsonEnv: boolean;
    jsonLength: number;
    hasBase64Env: boolean;
    hasClientEmail: boolean;
    hasPrivateKey: boolean;
  } | null>(null);

  useEffect(() => {
    if (ga4Configured) return;

    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch("/api/admin/analytics/config");
        const json = await res.json().catch(() => null);
        if (!cancelled && json && typeof json === "object") {
          setConfigDiag(json);
        }
      } catch {
        // ignore
      }
    }

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [ga4Configured]);

  useEffect(() => {
    if (!ga4Configured) return;

    let cancelled = false;

    async function loadRealtime(initial = false) {
      if (initial) setLoadingRealtime(true);
      try {
        const res = await fetch("/api/admin/analytics/realtime", { cache: "no-store" });
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
        if (!cancelled && initial) setLoadingRealtime(false);
      }
    }

    async function loadSummary() {
      try {
        const res = await fetch("/api/admin/analytics/summary", { cache: "no-store" });
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

    void loadRealtime(true);
    void loadSummary();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadRealtime(false);
    }, REALTIME_POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") void loadRealtime(false);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ga4Configured]);

  if (!ga4Configured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-dark">Site traffic</h2>
        {ga4ConfigHint ? (
          <p className="mt-2 text-sm text-amber-900">{ga4ConfigHint}</p>
        ) : (
          <p className="mt-2 text-sm text-meta-3">
            Connect Google Analytics 4 to see live visitors and traffic on this dashboard. Set{" "}
            <code className="text-xs">GA4_PROPERTY_ID</code> and either{" "}
            <code className="text-xs">GA4_SERVICE_ACCOUNT_JSON_BASE64</code>, or{" "}
            <code className="text-xs">GA4_CLIENT_EMAIL</code> +{" "}
            <code className="text-xs">GA4_PRIVATE_KEY</code> in your environment.
          </p>
        )}
        {configDiag ? (
          <ul className="mt-3 space-y-1 text-xs text-amber-900">
            <li>GA4_PROPERTY_ID: {configDiag.hasPropertyId ? "set" : "missing"}</li>
            <li>
              GA4_SERVICE_ACCOUNT_JSON_BASE64: {configDiag.hasBase64Env ? "set" : "not set"}
            </li>
            <li>GA4_CLIENT_EMAIL: {configDiag.hasClientEmail ? "set" : "not set"}</li>
            <li>GA4_PRIVATE_KEY: {configDiag.hasPrivateKey ? "set" : "not set"}</li>
          </ul>
        ) : null}
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
              <LiveUserCount value={realtime?.activeUsers ?? 0} />
              <p className="mt-1 text-xs text-emerald-700">Updates every 3 seconds</p>
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
          Live count from GA4 realtime. 7-day stats from{" "}
          <Link href="/analytics" className="text-blue hover:underline">
            analytics dashboard
          </Link>
          .
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
