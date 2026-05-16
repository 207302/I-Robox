import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runApiRoute } from "@/lib/api/runApiRoute";

/**
 * Deletes OTP rows that are no longer needed:
 * - expired OTPs
 * - used OTPs older than 1 day
 *
 * Protect with CRON_SECRET (Bearer token in Authorization header).
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
  
    const now = new Date();
    const usedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
    const result = await prisma.signup_email_otps.deleteMany({
      where: {
        OR: [{ expires_at: { lt: now } }, { used_at: { not: null, lt: usedBefore } }],
      },
    });
  
    return NextResponse.json(
      { ok: true, deleted: result.count, ranAt: now.toISOString() },
      { status: 200 }
    );
  
  });}

