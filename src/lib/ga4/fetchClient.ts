import type { AnalyticsDashboardResult, DateRange } from "./types";

export async function fetchAnalyticsSection<T>(
  endpoint: string,
  range: DateRange
): Promise<{ data: T | null; error: string | null }> {
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });

  try {
    const response = await fetch(`/api/analytics/${endpoint}?${params.toString()}`);
    const json = await response.json();
    if (!response.ok) {
      return { data: null, error: json.error ?? `Failed to load ${endpoint}` };
    }
    return { data: json.data as T, error: null };
  } catch {
    return { data: null, error: `Network error loading ${endpoint}` };
  }
}

export async function fetchAnalyticsDashboard(
  range: DateRange
): Promise<{ data: AnalyticsDashboardResult | null; error: string | null; cached: boolean }> {
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });

  try {
    const response = await fetch(`/api/analytics/dashboard?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) {
      return { data: null, error: json.error ?? "Failed to load dashboard", cached: false };
    }
    return {
      data: json.data as AnalyticsDashboardResult,
      error: null,
      cached: Boolean(json.cached),
    };
  } catch {
    return { data: null, error: "Network error loading dashboard", cached: false };
  }
}
