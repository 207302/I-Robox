import { NextRequest, NextResponse } from "next/server";
import { runReviewRequestEmails } from "@/lib/marketing/runReviewRequestEmails";
import { runApiRoute } from "@/lib/api/runApiRoute";

/**
 * Sends review-request emails for delivered orders past the configured delay,
 * only when the order still has items without a review.
 */
export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") ?? "";
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const hasValidBearer = !!cronSecret && auth === `Bearer ${cronSecret}`;

    if (!isVercelCron && !hasValidBearer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runReviewRequestEmails();
    return NextResponse.json(result);
  });
}
