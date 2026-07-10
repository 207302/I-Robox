import { NextResponse } from "next/server";
import { buildCacheKey, getCached } from "@/lib/ga4/cache";
import { getAnalyticsDashboardBundle } from "@/lib/ga4/queries";
import { parseDateRangeParams } from "@/lib/ga4/validateDateRange";
import type { AnalyticsDashboardBundle, ApiErrorResponse, ApiResponse } from "@/lib/ga4/types";
import { runApiRoute } from "@/lib/api/runApiRoute";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runApiRoute(async () => {
    const { searchParams } = new URL(request.url);
    const parsed = parseDateRangeParams(
      searchParams.get("startDate"),
      searchParams.get("endDate")
    );

    if (!parsed.ok) {
      return NextResponse.json<ApiErrorResponse>({ error: parsed.error }, { status: 400 });
    }

    const { startDate, endDate } = parsed.range;
    const cacheKey = buildCacheKey("dashboardBundle", startDate, endDate);
    const wasCached = Boolean(getCached<AnalyticsDashboardBundle>(cacheKey));

    try {
      const data = await getAnalyticsDashboardBundle(parsed.range);
      return NextResponse.json<ApiResponse<AnalyticsDashboardBundle>>({
        data,
        cached: wasCached,
        startDate,
        endDate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch analytics dashboard";
      return NextResponse.json<ApiErrorResponse>({ error: message }, { status: 500 });
    }
  });
}
