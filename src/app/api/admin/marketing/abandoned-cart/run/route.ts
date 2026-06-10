import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runAbandonedCartReminders } from "@/lib/marketing/runAbandonedCartReminders";
import { runApiRoute } from "@/lib/api/runApiRoute";

/** Admin: manually run the abandoned-cart reminder job (no SSH/cron needed). */
export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_abandoned_cart_run:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await runAbandonedCartReminders();
    return NextResponse.json(result);
  });
}
