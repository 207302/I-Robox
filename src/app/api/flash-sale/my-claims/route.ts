import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCustomerFlashSaleClaimTags } from "@/lib/flashSale/claims";
import { runApiRoute } from "@/lib/api/runApiRoute";

export const dynamic = "force-dynamic";

/** Claimed flash-sale tags for the signed-in customer (empty for guests). */
export async function GET() {
  return runApiRoute(async () => {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ tags: [] as string[] }, { status: 200 });
    }
    const tags = await listCustomerFlashSaleClaimTags(session.sub);
    return NextResponse.json(
      { tags },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  });
}
