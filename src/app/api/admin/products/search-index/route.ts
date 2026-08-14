import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { loadAdminProductSearchIndex } from "@/lib/shop/shopSearchIndex";

export const dynamic = "force-dynamic";

export async function GET() {
  return runApiRoute(
    async () => {
      const auth = await requireAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const items = await loadAdminProductSearchIndex();
      return NextResponse.json(
        { items },
        {
          headers: {
            "cache-control": "no-store, no-cache, must-revalidate",
            pragma: "no-cache",
            expires: "0",
          },
        }
      );
    },
    { timeoutMs: 15_000, name: "GET /api/admin/products/search-index" }
  );
}
