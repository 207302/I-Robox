import { NextRequest, NextResponse } from "next/server";
import { getShopListing } from "@/lib/shop/shopListing";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(req: NextRequest) {
  return runApiRoute(
    async () => {
      const result = await getShopListing(new URL(req.url).searchParams);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result.data);
    },
    { timeoutMs: 15_000 }
  );
}
