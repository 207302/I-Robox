import { NextRequest, NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth/session";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { redirectUrl } from "@/lib/siteUrl";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    await clearAdminSessionCookie();
    // 303 ensures browser follows redirect with GET after POST logout.
    return NextResponse.redirect(redirectUrl(req, "/admin/login"), { status: 303 });
  });
}
