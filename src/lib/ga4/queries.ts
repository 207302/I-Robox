import "server-only";
import { format, parseISO } from "date-fns";
import { buildCacheKey, getCached, setCached } from "./cache";
import { dimensionString, metricNumber, runRealtimeReport, runReport } from "./client";
import { formatGaDate } from "./formatters";
import { getPreviousDateRange } from "./validateDateRange";
import type {
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
  type AnalyticsDashboardBundle,
} from "./types";

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
  const response = await runReport({
    dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
    metrics: SUMMARY_METRICS.map((name) => ({ name })),
  });

  const row = response.rows?.[0];
  const sessions = metricNumber(row, 0);
  const transactions = metricNumber(row, 6);
  const purchaseRevenue = metricNumber(row, 5);
  const averagePurchaseRevenue = metricNumber(row, 7);

  return {
    sessions,
    totalUsers: metricNumber(row, 1),
    newUsers: metricNumber(row, 2),
    engagedSessions: metricNumber(row, 3),
    averageSessionDuration: metricNumber(row, 4),
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
): Promise<AnalyticsDashboardBundle> {
  const cacheKey = buildCacheKey("dashboardBundle", range.startDate, range.endDate);
  const cached = getCached<AnalyticsDashboardBundle>(cacheKey);
  if (cached) return cached;

  const [summary, traffic, ecommerce, pages, geo, devices, behaviour] = await Promise.all([
    getExecutiveSummary(range),
    getTrafficAcquisition(range),
    getEcommercePerformance(range),
    getLandingPageAnalysis(range),
    getGeographicData(range),
    getDeviceData(range),
    getUserBehaviour(range),
  ]);

  const data = { summary, traffic, ecommerce, pages, geo, devices, behaviour };
  setCached(cacheKey, data);
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

  const rows: TrafficRow[] = (response.rows ?? []).map((row) => {
    const sessions = metricNumber(row, 1);
    const transactions = metricNumber(row, 3);
    return {
      channel: dimensionString(row, 0) || "Unassigned",
      users: metricNumber(row, 0),
      sessions,
      revenue: metricNumber(row, 2),
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
      dimensions: [{ name: "itemName" }, { name: "itemCategory" }],
      metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 10,
    }),
    runReport({
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "purchaseRevenue" }],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    }),
  ]);

  const summaryRow = summaryResponse.rows?.[0];
  const transactions = metricNumber(summaryRow, 0);
  const purchaseRevenue = metricNumber(summaryRow, 1);
  const averagePurchaseRevenue = metricNumber(summaryRow, 2);
  const sessions = metricNumber(summaryRow, 3);

  const topProducts: ProductRow[] = (productsResponse.rows ?? []).map((row, index) => ({
    rank: index + 1,
    name: dimensionString(row, 0) || "(not set)",
    category: dimensionString(row, 1) || "—",
    revenue: metricNumber(row, 0),
    quantity: metricNumber(row, 1),
  }));

  const revenueTrend: RevenueTrendPoint[] = (trendResponse.rows ?? []).map((row) => {
    const date = dimensionString(row, 0);
    return {
      date,
      label: formatGaDate(date),
      revenue: metricNumber(row, 0),
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
      { name: "conversions" },
      { name: "purchaseRevenue" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 50,
  });

  const rows: LandingPageRow[] = (response.rows ?? []).map((row) => ({
    page: dimensionString(row, 0) || "/",
    users: metricNumber(row, 0),
    sessions: metricNumber(row, 1),
    engagementRate: metricNumber(row, 2) * 100,
    conversions: metricNumber(row, 3),
    revenue: metricNumber(row, 4),
  }));

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
    dimensions: [{ name: "country" }, { name: "city" }, { name: "countryId" }],
    metrics: [
      { name: "totalUsers" },
      { name: "purchaseRevenue" },
      { name: "transactions" },
    ],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 100,
  });

  const rows: GeoRow[] = (response.rows ?? []).map((row, index) => ({
    rank: index + 1,
    country: dimensionString(row, 0) || "Unknown",
    city: dimensionString(row, 1) || "—",
    countryCode: dimensionString(row, 2),
    users: metricNumber(row, 0),
    revenue: metricNumber(row, 1),
    transactions: metricNumber(row, 2),
  }));

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
    const sessions = metricNumber(row, 1);
    const transactions = metricNumber(row, 2);
    return {
      device: dimensionString(row, 0) || "unknown",
      users: metricNumber(row, 0),
      sessions,
      conversionRate: sessions > 0 ? (transactions / sessions) * 100 : 0,
      revenue: metricNumber(row, 3),
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
      { name: "averageSessionDuration" },
      { name: "exitRate" },
      { name: "totalUsers" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 100,
  });

  const rows: BehaviourRow[] = (response.rows ?? []).map((row) => ({
    pagePath: dimensionString(row, 0) || "/",
    pageViews: metricNumber(row, 0),
    avgTime: metricNumber(row, 1),
    exitRate: metricNumber(row, 2) * 100,
    users: metricNumber(row, 3),
  }));

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

  const data: RealtimeUsersData = {
    activeUsers: metricNumber(response.rows?.[0], 0),
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
