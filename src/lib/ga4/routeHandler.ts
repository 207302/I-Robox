import "server-only";
import { NextResponse } from "next/server";
import { buildCacheKey, getCached } from "./cache";
import { formatGa4ApiError } from "./client";
import { parseDateRangeParams } from "./validateDateRange";
import type { ApiErrorResponse, ApiResponse } from "./types";

type RouteHandler<T> = (range: { startDate: string; endDate: string }) => Promise<T>;

export function createAnalyticsRoute<T>(
  queryName: string,
  handler: RouteHandler<T>
) {
  return async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const parsed = parseDateRangeParams(
      searchParams.get("startDate"),
      searchParams.get("endDate")
    );

    if (!parsed.ok) {
      return NextResponse.json<ApiErrorResponse>({ error: parsed.error }, { status: 400 });
    }

    const { startDate, endDate } = parsed.range;
    const cacheKey = buildCacheKey(queryName, startDate, endDate);
    const cachedData = getCached<T>(cacheKey);
    if (cachedData) {
      return NextResponse.json<ApiResponse<T>>({
        data: cachedData,
        cached: true,
        startDate,
        endDate,
      });
    }

    try {
      const data = await handler(parsed.range);
      return NextResponse.json<ApiResponse<T>>({
        data,
        cached: false,
        startDate,
        endDate,
      });
    } catch (error) {
      const message = formatGa4ApiError(error);
      return NextResponse.json<ApiErrorResponse>({ error: message }, { status: 500 });
    }
  };
}
