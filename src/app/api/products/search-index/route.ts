import { NextResponse } from "next/server";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { loadShopProductSearchIndex } from "@/lib/shop/shopSearchIndex";

export async function GET() {
  return runApiRoute(
    async () => {
      const items = await loadShopProductSearchIndex();
      return NextResponse.json(
        { items },
        {
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        }
      );
    },
    { timeoutMs: 15_000, name: "GET /api/products/search-index" }
  );
}
