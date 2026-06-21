import type { DateRange } from "./types";

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
