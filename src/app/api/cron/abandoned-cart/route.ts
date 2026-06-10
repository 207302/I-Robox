import { NextRequest, NextResponse } from "next/server";
import { runAbandonedCartReminders } from "@/lib/marketing/runAbandonedCartReminders";
import { runApiRoute } from "@/lib/api/runApiRoute";

/**
 * Sends one reminder email per cart after idle period (logged-in customers only).
 * Protect with CRON_SECRET or Vercel cron header.
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

    const result = await runAbandonedCartReminders();
    return NextResponse.json(result);
  });
}
