import { NextRequest, NextResponse } from "next/server";
import { clearAdminSessionCookieOnResponse } from "@/lib/auth/session";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { redirectUrl } from "@/lib/siteUrl";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    const response = NextResponse.redirect(redirectUrl(req, "/admin/login"), { status: 303 });
    clearAdminSessionCookieOnResponse(response);
    return response;
  });
}
