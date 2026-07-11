"use client";

import { format, subDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import DateRangePicker from "@/components/Analytics/DateRangePicker";
import DeviceAnalysis from "@/components/Analytics/DeviceAnalysis";
import EcommercePerformance from "@/components/Analytics/EcommercePerformance";
import ExecutiveSummary from "@/components/Analytics/ExecutiveSummary";
import ExportControls from "@/components/Analytics/ExportControls";
import GeographicAnalysis from "@/components/Analytics/GeographicAnalysis";
import LandingPageAnalysis from "@/components/Analytics/LandingPageAnalysis";
import TrafficAcquisition from "@/components/Analytics/TrafficAcquisition";
import UserBehaviour from "@/components/Analytics/UserBehaviour";
import { fetchAnalyticsDashboard } from "@/lib/ga4/fetchClient";
import type {
  DashboardExportData,
  DateRange,
  DeviceData,
  EcommercePerformanceData,
  ExecutiveSummaryData,
  GeographicData,
  LandingPageAnalysisData,
  TrafficAcquisitionData,
  UserBehaviourData,
} from "@/lib/ga4/types";

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function defaultRange(): DateRange {
  const end = new Date();
  return {
    startDate: format(subDays(end, 29), "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

function initialSection<T>(): SectionState<T> {
  return { data: null, loading: true, error: null };
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function AnalyticsDashboardPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);

  const [summary, setSummary] = useState(initialSection<ExecutiveSummaryData>());
  const [traffic, setTraffic] = useState(initialSection<TrafficAcquisitionData>());
  const [ecommerce, setEcommerce] = useState(initialSection<EcommercePerformanceData>());
  const [pages, setPages] = useState(initialSection<LandingPageAnalysisData>());
  const [geo, setGeo] = useState(initialSection<GeographicData>());
  const [devices, setDevices] = useState(initialSection<DeviceData>());
  const [behaviour, setBehaviour] = useState(initialSection<UserBehaviourData>());

  const loadDashboard = useCallback(async (range: DateRange) => {
    setSummary((s) => ({ ...s, loading: true, error: null }));
    setTraffic((s) => ({ ...s, loading: true, error: null }));
    setEcommerce((s) => ({ ...s, loading: true, error: null }));
    setPages((s) => ({ ...s, loading: true, error: null }));
    setGeo((s) => ({ ...s, loading: true, error: null }));
    setDevices((s) => ({ ...s, loading: true, error: null }));
    setBehaviour((s) => ({ ...s, loading: true, error: null }));

    const result = await fetchAnalyticsDashboard(range);
    if (result.error || !result.data) {
      const error = result.error ?? "Failed to load dashboard";
      setSummary({ data: null, loading: false, error });
      setTraffic({ data: null, loading: false, error });
      setEcommerce({ data: null, loading: false, error });
      setPages({ data: null, loading: false, error });
      setGeo({ data: null, loading: false, error });
      setDevices({ data: null, loading: false, error });
      setBehaviour({ data: null, loading: false, error });
      return;
    }

    const { summary: s, traffic: t, ecommerce: e, pages: p, geo: g, devices: d, behaviour: b, sectionErrors } =
      result.data;

    setSummary({ data: s, loading: false, error: sectionErrors?.summary ?? null });
    setTraffic({ data: t, loading: false, error: sectionErrors?.traffic ?? null });
    setEcommerce({ data: e, loading: false, error: sectionErrors?.ecommerce ?? null });
    setPages({ data: p, loading: false, error: sectionErrors?.pages ?? null });
    setGeo({ data: g, loading: false, error: sectionErrors?.geo ?? null });
    setDevices({ data: d, loading: false, error: sectionErrors?.devices ?? null });
    setBehaviour({ data: b, loading: false, error: sectionErrors?.behaviour ?? null });
  }, []);

  useEffect(() => {
    void loadDashboard(dateRange);
  }, [dateRange, loadDashboard]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [darkMode]);

  const exportData: DashboardExportData = useMemo(
    () => ({
      summary: summary.data,
      traffic: traffic.data,
      ecommerce: ecommerce.data,
      pages: pages.data,
      geo: geo.data,
      devices: devices.data,
      behaviour: behaviour.data,
      dateRange,
    }),
    [summary.data, traffic.data, ecommerce.data, pages.data, geo.data, devices.data, behaviour.data, dateRange]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            i-robox.com
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            GA4 Analytics Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Google Analytics 4 reporting via the Data API. Cached responses load instantly; fresh data may take a few seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setDarkMode((value) => !value)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
          <ExportControls exportData={exportData} />
        </div>
      </header>

      <div className="print:hidden">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <SectionBlock title="Executive summary" description="Key metrics vs the previous period of equal length.">
        <ExecutiveSummary data={summary.data} loading={summary.loading} error={summary.error} />
      </SectionBlock>

      <SectionBlock title="Traffic acquisition" description="Sessions and revenue by default channel group.">
        <TrafficAcquisition data={traffic.data} loading={traffic.loading} error={traffic.error} />
      </SectionBlock>

      <SectionBlock title="Ecommerce performance" description="Orders, revenue, and top products.">
        <EcommercePerformance data={ecommerce.data} loading={ecommerce.loading} error={ecommerce.error} />
      </SectionBlock>

      <SectionBlock title="Landing page analysis" description="Top 50 landing pages by sessions.">
        <LandingPageAnalysis data={pages.data} loading={pages.loading} error={pages.error} />
      </SectionBlock>

      <SectionBlock title="Geographic analysis" description="Users and revenue by country and city.">
        <GeographicAnalysis data={geo.data} loading={geo.loading} error={geo.error} />
      </SectionBlock>

      <SectionBlock title="Device analysis" description="Desktop, mobile, and tablet breakdown.">
        <DeviceAnalysis data={devices.data} loading={devices.loading} error={devices.error} />
      </SectionBlock>

      <SectionBlock title="User behaviour" description="Top pages by screen page views.">
        <UserBehaviour data={behaviour.data} loading={behaviour.loading} error={behaviour.error} />
      </SectionBlock>
    </div>
  );
}
