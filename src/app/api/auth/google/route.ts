import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runApiRoute } from "@/lib/api/runApiRoute";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  buildGoogleAuthorizeUrl,
  getGoogleOAuthConfig,
  googleRedirectUri,
  randomOAuthState,
  sanitizeOAuthNextParam,
} from "@/lib/auth/googleOAuth";

const STATE_MAX_AGE = 600;

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`google-oauth-start:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    let config: ReturnType<typeof getGoogleOAuthConfig>;
    try {
      config = getGoogleOAuthConfig();
    } catch {
      return NextResponse.redirect(new URL("/login?error=google_config", req.nextUrl.origin));
    }
  
    const state = randomOAuthState();
    const redirectUri = googleRedirectUri(req);
    const url = buildGoogleAuthorizeUrl({
      clientId: config.clientId,
      redirectUri,
      state,
    });
  
    const nextRaw = req.nextUrl.searchParams.get("next");
    const nextPath = sanitizeOAuthNextParam(nextRaw);
  
    const res = NextResponse.redirect(url);
    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: STATE_MAX_AGE,
    };
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieBase);
    res.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, nextPath, {
      ...cookieBase,
      maxAge: STATE_MAX_AGE,
    });
    return res;
  
  });}
