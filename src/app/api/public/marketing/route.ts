import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildPublicMarketingPayload } from "@/lib/marketing/publicMarketingPayload";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { privateResponseCacheHeaders } from "@/lib/api/httpCache";

/** Popup audience depends on session cookie — private browser cache only. */
const PUBLIC_MARKETING_CACHE_SECONDS = 60;

export async function GET() {
  return runApiRoute(
    async () => {
      const session = await getSession();
      const payload = await buildPublicMarketingPayload(session);

      return NextResponse.json(payload, {
        headers: privateResponseCacheHeaders(PUBLIC_MARKETING_CACHE_SECONDS),
      });
    },
    { name: "GET /api/public/marketing", timeoutMs: 15_000 }
  );
}
