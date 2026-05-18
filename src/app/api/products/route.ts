/**
 * Anonymous shop listing JSON.
 * - `facets=0` skips facet aggregation (pagination-only; client merges prior facets).
 * - Search `q` bypasses server data cache; shorter CDN max-age (10s).
 * - Filter-only URLs: listing `unstable_cache` 30s + facets 600s (separate layers), merged before respond.
 */
import { NextRequest, NextResponse } from "next/server";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { shopListingResponseHeaders } from "@/lib/api/httpCache";
import { getShopListingForApi } from "@/lib/shop/shopListingCache";

export async function GET(req: NextRequest) {
  return runApiRoute(
    async () => {
      const params = new URL(req.url).searchParams;
      const result = await getShopListingForApi(params);

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(result.data, {
        headers: shopListingResponseHeaders(params, {
          listingCache: result.listingCache,
        }),
      });
    },
    {
      timeoutMs: 15_000,
      name: "GET /api/products",
    }
  );
}
