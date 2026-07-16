import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { isUuid } from "@/lib/validation/input";
import { sendReviewRequestEmailForOrder } from "@/lib/orders/maybeSendReviewRequestEmail";

/** Admin: send (or resend) a review-request email for one delivered order with unreviewed items. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runAdminApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_order_review_request:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await sendReviewRequestEmailForOrder(id, { force: true });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    if ("skipped" in result && result.skipped) {
      const messages: Record<string, string> = {
        smtp_not_configured: "SMTP not configured",
        already_sent: "Review email already sent",
        no_email: "Customer has no email",
        no_unreviewed_items: "Customer already reviewed all items on this order",
        not_delivered: "Order is not delivered yet",
        order_not_found: "Order not found",
        disabled: "Review request emails are disabled",
        waiting_delay: "Waiting for delay",
        not_delivered_transition: "Not a delivery transition",
      };
      return NextResponse.json(
        { ok: false, skipped: true, reason: result.reason, error: messages[result.reason] ?? result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      sentTo: "sentTo" in result ? result.sentTo : undefined,
      itemCount: "itemCount" in result ? result.itemCount : undefined,
    });
  }, { name: "POST /api/admin/orders/[id]/review-request" });
}
