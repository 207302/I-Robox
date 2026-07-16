import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runReviewRequestEmails } from "@/lib/marketing/runReviewRequestEmails";
import { runApiRoute } from "@/lib/api/runApiRoute";

/**
 * Admin: send review-request emails now.
 * Only delivered orders that still have unreviewed items (and have not been emailed yet).
 * Ignores the delay so pending-but-not-yet-due orders can be included when you press send.
 */
export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_review_requests_run:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await runReviewRequestEmails({ ignoreDelay: true });
    return NextResponse.json(result);
  });
}
