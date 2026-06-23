import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { runLatestDropBroadcast } from "@/lib/marketing/runLatestDropBroadcast";
import { fetchLatestDropEmailProducts } from "@/lib/marketing/fetchLatestDropEmailProducts";

/** Preview which products would be included in the next broadcast (no emails sent). */
export async function GET() {
  return runAdminApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const products = await fetchLatestDropEmailProducts();
    return NextResponse.json({
      productCount: products.length,
      products: products.map((p) => ({
        name: p.name,
        priceLabel: p.priceLabel,
        productUrl: p.productUrl,
      })),
    });
  }, { name: "GET /api/admin/marketing/notify-signups/broadcast" });
}

/** Send latest-drop email to all notify-signup contacts. */
export async function POST(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_latest_drop_broadcast:${req.ip ?? "unknown"}`, 1);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const auth = await requireAdminWrite();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const result = await runLatestDropBroadcast();
      return NextResponse.json(result);
    },
    { name: "POST /api/admin/marketing/notify-signups/broadcast", timeoutMs: 300_000 }
  );
}
