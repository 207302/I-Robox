import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCustomerFlashSaleClaimUsage } from "@/lib/flashSale/claims";
import { runApiRoute } from "@/lib/api/runApiRoute";

export const dynamic = "force-dynamic";

/** Claimed flash-sale usage for the signed-in customer (empty for guests). */
export async function GET() {
  return runApiRoute(async () => {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json(
        { usage: {} as Record<string, number>, tags: [] as string[] },
        { status: 200 }
      );
    }
    const usage = await listCustomerFlashSaleClaimUsage(session.sub);
    return NextResponse.json(
      { usage, tags: Object.keys(usage) },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  });
}
