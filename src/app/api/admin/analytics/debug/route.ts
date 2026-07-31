import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { formatGa4CredentialError, isGa4Configured } from "@/lib/ga4/credentials";
import { getGa4PropertyResource, metricsByName, runReport } from "@/lib/ga4/client";
import { defaultDateRangeLast7Days } from "@/lib/ga4/queries";
import { parseDateRangeParams } from "@/lib/ga4/validateDateRange";
import { runApiRoute } from "@/lib/api/runApiRoute";

/**
 * Admin-only diagnostic: returns the exact GA4 Data API request + raw response
 * for revenue/users so you can tell request-side vs render-side issues apart.
 *
 * GET /api/admin/analytics/debug?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * (dates optional — defaults to last 7 calendar days)
 */
export async function GET(request: Request) {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isGa4Configured()) {
      return NextResponse.json(
        {
          error:
            "GA4 is not configured. Set GA4_PROPERTY_ID and service-account credentials.",
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");
    const range =
      startParam || endParam
        ? (() => {
            const parsed = parseDateRangeParams(startParam, endParam);
            if (!parsed.ok) return null;
            return parsed.range;
          })()
        : defaultDateRangeLast7Days();

    if (!range) {
      return NextResponse.json(
        { error: "Invalid startDate/endDate (use YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const metrics = [
      "sessions",
      "totalUsers",
      "newUsers",
      "purchaseRevenue",
      "totalRevenue",
      "transactions",
      "averagePurchaseRevenue",
    ] as const;

    const requestBody = {
      property: getGa4PropertyResource(),
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      metrics: metrics.map((name) => ({ name })),
    };

    try {
      const response = await runReport({
        dateRanges: requestBody.dateRanges,
        metrics: requestBody.metrics,
      });

      const parsed = metricsByName(response, metrics);

      return NextResponse.json({
        ok: true,
        note:
          "purchaseRevenue counts GA4 purchase events only (not store DB sales). " +
          "Currency values are decimal property-currency amounts, not micros. " +
          "GA4 often lags several hours on revenue.",
        request: requestBody,
        raw: {
          metricHeaders: response.metricHeaders ?? [],
          rowCount: response.rows?.length ?? 0,
          rows: response.rows ?? [],
          totals: response.totals ?? [],
          metadata: response.metadata ?? null,
        },
        parsedByMetricName: parsed,
        range,
      });
    } catch (error) {
      console.error("[ga4] debug report failed", error);
      return NextResponse.json(
        {
          ok: false,
          request: requestBody,
          error: formatGa4CredentialError(error),
          range,
        },
        { status: 500 }
      );
    }
  });
}
