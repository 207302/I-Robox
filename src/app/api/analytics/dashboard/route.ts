import { NextResponse } from "next/server";
import { buildCacheKey, getCached } from "@/lib/ga4/cache";
import { formatGa4ApiError } from "@/lib/ga4/client";
import { getAnalyticsDashboardBundle } from "@/lib/ga4/queries";
import { parseDateRangeParams } from "@/lib/ga4/validateDateRange";
import type { AnalyticsDashboardResult, ApiErrorResponse, ApiResponse } from "@/lib/ga4/types";
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
    const wasCached = Boolean(getCached<AnalyticsDashboardResult>(cacheKey));

    try {
      const data = await getAnalyticsDashboardBundle(parsed.range);
      return NextResponse.json<ApiResponse<AnalyticsDashboardResult>>({
        data,
        cached: wasCached,
        startDate,
        endDate,
      });
    } catch (error) {
      const message = formatGa4ApiError(error);
      return NextResponse.json<ApiErrorResponse>({ error: message }, { status: 500 });
    }
  });
}
