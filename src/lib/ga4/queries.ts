import "server-only";
import { format, parseISO } from "date-fns";
import { buildCacheKey, getCached, setCached } from "./cache";
import {
  dimensionsByName,
  formatGa4ApiError,
  metricsByName,
  runRealtimeReport,
  runReport,
} from "./client";
import { formatGaDate } from "./formatters";
import { getPreviousDateRange } from "./validateDateRange";
import type {
  AnalyticsDashboardBundle,
  AnalyticsDashboardResult,
  BehaviourRow,
  DateRange,
  DeviceData,
  DeviceRow,
  EcommercePerformanceData,
  ExecutiveSummaryData,
  GeographicData,
  GeoRow,
  LandingPageAnalysisData,
  LandingPageRow,
  MetricSnapshot,
  ProductRow,
  RealtimeUsersData,
  RevenueTrendPoint,
  TrafficAcquisitionData,
  TrafficRow,
  UserBehaviourData,
} from "./types";

const EMPTY_METRIC_SNAPSHOT: MetricSnapshot = {
  sessions: 0,
  totalUsers: 0,
  newUsers: 0,
  engagedSessions: 0,
  averageSessionDuration: 0,
  purchaseRevenue: 0,
  transactions: 0,
  conversionRate: 0,
  averagePurchaseRevenue: 0,
};

const SUMMARY_METRICS = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "averageSessionDuration",
  "purchaseRevenue",
  "transactions",
  "averagePurchaseRevenue",
] as const;

async function fetchMetricSnapshot(range: DateRange): Promise<MetricSnapshot> {
  const request = {
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    metrics: SUMMARY_METRICS.map((name) => ({ name })),
  };
  const response = await runReport(request);
  const m = metricsByName(response, SUMMARY_METRICS);

  const sessions = m.sessions ?? 0;
  const transactions = m.transactions ?? 0;
  const purchaseRevenue = m.purchaseRevenue ?? 0;
  const averagePurchaseRevenue = m.averagePurchaseRevenue ?? 0;

  if (
    process.env.NODE_ENV !== "production" ||
    process.env.GA4_DEBUG_LOG === "1"
  ) {
    console.info("[ga4] fetchMetricSnapshot", {
      range,
      metricHeaders: (response.metricHeaders ?? []).map((h) => h?.name),
      rowCount: response.rows?.length ?? 0,
      hasTotals: Boolean(response.totals?.length),
      parsed: {
        totalUsers: m.totalUsers,
        purchaseRevenue,
        transactions,
        sessions,
      },
    });
  }

  return {
    sessions,
    totalUsers: m.totalUsers ?? 0,
    newUsers: m.newUsers ?? 0,
    engagedSessions: m.engagedSessions ?? 0,
    averageSessionDuration: m.averageSessionDuration ?? 0,
    purchaseRevenue,
    transactions,
    averagePurchaseRevenue:
      averagePurchaseRevenue > 0
        ? averagePurchaseRevenue
        : transactions > 0
          ? purchaseRevenue / transactions
          : 0,
    conversionRate: sessions > 0 ? (transactions / sessions) * 100 : 0,
  };
}

export async function getExecutiveSummary(range: DateRange): Promise<ExecutiveSummaryData> {
  const cacheKey = buildCacheKey("executiveSummary", range.startDate, range.endDate);
  const cached = getCached<ExecutiveSummaryData>(cacheKey);
  if (cached) return cached;

  const previousRange = getPreviousDateRange(range);
  const [current, previous] = await Promise.all([
    fetchMetricSnapshot(range),
    fetchMetricSnapshot(previousRange),
  ]);

  const data = { current, previous };
  setCached(cacheKey, data);
  return data;
}

/** Admin dashboard widget — current period only (one GA4 call vs two). */
export async function getExecutiveSummaryQuick(
  range: DateRange
): Promise<{ current: MetricSnapshot }> {
  const cacheKey = buildCacheKey("executiveSummaryCurrent", range.startDate, range.endDate);
  const cached = getCached<{ current: MetricSnapshot }>(cacheKey);
  if (cached) return cached;

  const current = await fetchMetricSnapshot(range);
  const data = { current };
  setCached(cacheKey, data);
  return data;
}

export async function getAnalyticsDashboardBundle(
  range: DateRange
): Promise<AnalyticsDashboardResult> {
  const cacheKey = buildCacheKey("dashboardBundle", range.startDate, range.endDate);
  const cached = getCached<AnalyticsDashboardResult>(cacheKey);
  if (cached) return cached;

  type SectionKey = keyof AnalyticsDashboardBundle;
  const loaders: { key: SectionKey; load: () => Promise<AnalyticsDashboardBundle[SectionKey]> }[] = [
    { key: "summary", load: () => getExecutiveSummary(range) },
    { key: "traffic", load: () => getTrafficAcquisition(range) },
    { key: "ecommerce", load: () => getEcommercePerformance(range) },
    { key: "pages", load: () => getLandingPageAnalysis(range) },
    { key: "geo", load: () => getGeographicData(range) },
    { key: "devices", load: () => getDeviceData(range) },
    { key: "behaviour", load: () => getUserBehaviour(range) },
  ];

  const settled = await Promise.allSettled(loaders.map((entry) => entry.load()));
  const sectionErrors: Partial<Record<SectionKey, string>> = {};
  const partial: Partial<AnalyticsDashboardBundle> = {};

  settled.forEach((result, index) => {
    const { key } = loaders[index];
    if (result.status === "fulfilled") {
      partial[key] = result.value;
    } else {
      const message = formatGa4ApiError(result.reason);
      sectionErrors[key] = message;
      console.error(`[ga4] dashboard section "${key}" failed`, message, result.reason);
    }
  });

  if (Object.keys(partial).length === 0) {
    const first = Object.values(sectionErrors)[0];
    throw new Error(first ?? "All GA4 dashboard sections failed.");
  }

  const data: AnalyticsDashboardResult = {
    summary: partial.summary ?? { current: EMPTY_METRIC_SNAPSHOT, previous: EMPTY_METRIC_SNAPSHOT },
    traffic: partial.traffic ?? { rows: [], totals: { users: 0, sessions: 0, revenue: 0 } },
    ecommerce: partial.ecommerce ?? {
      transactions: 0,
      purchaseRevenue: 0,
      conversionRate: 0,
      averagePurchaseRevenue: 0,
      topProducts: [],
      revenueTrend: [],
    },
    pages: partial.pages ?? { rows: [] },
    geo: partial.geo ?? { rows: [] },
    devices: partial.devices ?? { rows: [], totals: { users: 0, sessions: 0, revenue: 0 } },
    behaviour: partial.behaviour ?? { rows: [] },
    ...(Object.keys(sectionErrors).length > 0 ? { sectionErrors } : {}),
  };

  // Never cache a partially-failed bundle as healthy zeros for 5 minutes.
  if (Object.keys(sectionErrors).length === 0) {
    setCached(cacheKey, data);
  }
  return data;
}

export async function getTrafficAcquisition(range: DateRange): Promise<TrafficAcquisitionData> {
  const cacheKey = buildCacheKey("trafficAcquisition", range.startDate, range.endDate);
  const cached = getCached<TrafficAcquisitionData>(cacheKey);
  if (cached) return cached;

  const response = await runReport({
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "purchaseRevenue" },
      { name: "transactions" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 25,
  });

  const metricNames = ["totalUsers", "sessions", "purchaseRevenue", "transactions"] as const;
  const rows: TrafficRow[] = (response.rows ?? []).map((row) => {
    const dims = dimensionsByName(response, row, ["sessionDefaultChannelGroup"]);
    const m = metricsByName(
      { metricHeaders: response.metricHeaders, rows: [row] },
      metricNames
    );
    const sessions = m.sessions ?? 0;
    const transactions = m.transactions ?? 0;
    return {
      channel: dims.sessionDefaultChannelGroup || "Unassigned",
      users: m.totalUsers ?? 0,
      sessions,
      revenue: m.purchaseRevenue ?? 0,
      conversionRate: sessions > 0 ? (transactions / sessions) * 100 : 0,
      percentOfSessions: 0,
    };
  });

  const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0);
  const normalized = rows.map((row) => ({
    ...row,
    percentOfSessions: totalSessions > 0 ? (row.sessions / totalSessions) * 100 : 0,
  }));

  const data: TrafficAcquisitionData = {
    rows: normalized,
    totals: {
      users: normalized.reduce((sum, row) => sum + row.users, 0),
      sessions: totalSessions,
      revenue: normalized.reduce((sum, row) => sum + row.revenue, 0),
    },
  };

  setCached(cacheKey, data);
  return data;
}

export async function getEcommercePerformance(range: DateRange): Promise<EcommercePerformanceData> {
  const cacheKey = buildCacheKey("ecommercePerformance", range.startDate, range.endDate);
  const cached = getCached<EcommercePerformanceData>(cacheKey);
  if (cached) return cached;

  const [summaryResponse, productsResponse, trendResponse] = await Promise.all([
    runReport({
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      metrics: [
        { name: "transactions" },
        { name: "purchaseRevenue" },
        { name: "averagePurchaseRevenue" },
        { name: "sessions" },
      ],
    }),
    runReport({
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: "itemName" }],
      metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 10,
    }).catch((err) => {
      console.error("[ga4] top products report failed", formatGa4ApiError(err));
      return { rows: [], metricHeaders: [], dimensionHeaders: [] };
    }),
    runReport({
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "purchaseRevenue" }],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    }),
  ]);

  const summaryMetrics = metricsByName(summaryResponse, [
    "transactions",
    "purchaseRevenue",
    "averagePurchaseRevenue",
    "sessions",
  ]);
  const transactions = summaryMetrics.transactions ?? 0;
  const purchaseRevenue = summaryMetrics.purchaseRevenue ?? 0;
  const averagePurchaseRevenue = summaryMetrics.averagePurchaseRevenue ?? 0;
  const sessions = summaryMetrics.sessions ?? 0;

  const topProducts: ProductRow[] = (productsResponse.rows ?? []).map((row, index) => {
    const dims = dimensionsByName(productsResponse, row, ["itemName"]);
    const m = metricsByName(
      { metricHeaders: productsResponse.metricHeaders, rows: [row] },
      ["itemRevenue", "itemsPurchased"]
    );
    return {
      rank: index + 1,
      name: dims.itemName || "(not set)",
      category: "—",
      revenue: m.itemRevenue ?? 0,
      quantity: m.itemsPurchased ?? 0,
    };
  });

  const revenueTrend: RevenueTrendPoint[] = (trendResponse.rows ?? []).map((row) => {
    const dims = dimensionsByName(trendResponse, row, ["date"]);
    const m = metricsByName(
      { metricHeaders: trendResponse.metricHeaders, rows: [row] },
      ["purchaseRevenue"]
    );
    const date = dims.date || "";
    return {
      date,
      label: formatGaDate(date),
      revenue: m.purchaseRevenue ?? 0,
    };
  });

  const data: EcommercePerformanceData = {
    transactions,
    purchaseRevenue,
    conversionRate: sessions > 0 ? (transactions / sessions) * 100 : 0,
    averagePurchaseRevenue:
      averagePurchaseRevenue > 0
        ? averagePurchaseRevenue
        : transactions > 0
          ? purchaseRevenue / transactions
          : 0,
    topProducts,
    revenueTrend,
  };

  setCached(cacheKey, data);
  return data;
}

export async function getLandingPageAnalysis(range: DateRange): Promise<LandingPageAnalysisData> {
  const cacheKey = buildCacheKey("landingPageAnalysis", range.startDate, range.endDate);
  const cached = getCached<LandingPageAnalysisData>(cacheKey);
  if (cached) return cached;

  const response = await runReport({
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    dimensions: [{ name: "landingPage" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "engagementRate" },
      { name: "purchaseRevenue" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 50,
  });

  const rows: LandingPageRow[] = (response.rows ?? []).map((row) => {
    const dims = dimensionsByName(response, row, ["landingPage"]);
    const m = metricsByName(
      { metricHeaders: response.metricHeaders, rows: [row] },
      ["totalUsers", "sessions", "engagementRate", "purchaseRevenue"]
    );
    return {
      page: dims.landingPage || "/",
      users: m.totalUsers ?? 0,
      sessions: m.sessions ?? 0,
      engagementRate: (m.engagementRate ?? 0) * 100,
      conversions: 0,
      revenue: m.purchaseRevenue ?? 0,
    };
  });

  const data = { rows };
  setCached(cacheKey, data);
  return data;
}

export async function getGeographicData(range: DateRange): Promise<GeographicData> {
  const cacheKey = buildCacheKey("geographicData", range.startDate, range.endDate);
  const cached = getCached<GeographicData>(cacheKey);
  if (cached) return cached;

  const response = await runReport({
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    dimensions: [{ name: "country" }, { name: "city" }],
    metrics: [
      { name: "totalUsers" },
      { name: "purchaseRevenue" },
      { name: "transactions" },
    ],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 100,
  });

  const rows: GeoRow[] = (response.rows ?? []).map((row, index) => {
    const dims = dimensionsByName(response, row, ["country", "city"]);
    const m = metricsByName(
      { metricHeaders: response.metricHeaders, rows: [row] },
      ["totalUsers", "purchaseRevenue", "transactions"]
    );
    return {
      rank: index + 1,
      country: dims.country || "Unknown",
      city: dims.city || "—",
      countryCode: "",
      users: m.totalUsers ?? 0,
      revenue: m.purchaseRevenue ?? 0,
      transactions: m.transactions ?? 0,
    };
  });

  const data = { rows };
  setCached(cacheKey, data);
  return data;
}

export async function getDeviceData(range: DateRange): Promise<DeviceData> {
  const cacheKey = buildCacheKey("deviceData", range.startDate, range.endDate);
  const cached = getCached<DeviceData>(cacheKey);
  if (cached) return cached;

  const response = await runReport({
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "transactions" },
      { name: "purchaseRevenue" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const rows: DeviceRow[] = (response.rows ?? []).map((row) => {
    const dims = dimensionsByName(response, row, ["deviceCategory"]);
    const m = metricsByName(
      { metricHeaders: response.metricHeaders, rows: [row] },
      ["totalUsers", "sessions", "transactions", "purchaseRevenue"]
    );
    const sessions = m.sessions ?? 0;
    const transactions = m.transactions ?? 0;
    return {
      device: dims.deviceCategory || "unknown",
      users: m.totalUsers ?? 0,
      sessions,
      conversionRate: sessions > 0 ? (transactions / sessions) * 100 : 0,
      revenue: m.purchaseRevenue ?? 0,
    };
  });

  const data: DeviceData = {
    rows,
    totals: {
      users: rows.reduce((sum, row) => sum + row.users, 0),
      sessions: rows.reduce((sum, row) => sum + row.sessions, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    },
  };

  setCached(cacheKey, data);
  return data;
}

export async function getUserBehaviour(range: DateRange): Promise<UserBehaviourData> {
  const cacheKey = buildCacheKey("userBehaviour", range.startDate, range.endDate);
  const cached = getCached<UserBehaviourData>(cacheKey);
  if (cached) return cached;

  const response = await runReport({
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "userEngagementDuration" },
      { name: "totalUsers" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 100,
  });

  const rows: BehaviourRow[] = (response.rows ?? []).map((row) => {
    const dims = dimensionsByName(response, row, ["pagePath"]);
    const m = metricsByName(
      { metricHeaders: response.metricHeaders, rows: [row] },
      ["screenPageViews", "userEngagementDuration", "totalUsers"]
    );
    const pageViews = m.screenPageViews ?? 0;
    const engagementSeconds = m.userEngagementDuration ?? 0;
    const users = m.totalUsers ?? 0;
    return {
      pagePath: dims.pagePath || "/",
      pageViews,
      avgTime: users > 0 ? engagementSeconds / users : engagementSeconds,
      exitRate: 0,
      users,
    };
  });

  const data = { rows };
  setCached(cacheKey, data);
  return data;
}

const REALTIME_CACHE_MS = 2_000;

let realtimeCache: { data: RealtimeUsersData; expiresAt: number } | null = null;

export async function getRealtimeUsers(options?: { fresh?: boolean }): Promise<RealtimeUsersData> {
  const now = Date.now();
  if (!options?.fresh && realtimeCache && realtimeCache.expiresAt > now) {
    return realtimeCache.data;
  }

  const response = await runRealtimeReport({
    metrics: [{ name: "activeUsers" }],
  });

  const m = metricsByName(response, ["activeUsers"]);
  const data: RealtimeUsersData = {
    activeUsers: m.activeUsers ?? 0,
    fetchedAt: new Date().toISOString(),
  };

  realtimeCache = { data, expiresAt: now + REALTIME_CACHE_MS };
  return data;
}

export function defaultDateRangeLast7Days(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

export function defaultDateRangeLast30Days(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

export function formatRangeLabel(range: DateRange): string {
  const start = parseISO(range.startDate);
  const end = parseISO(range.endDate);
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}
