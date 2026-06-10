import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth/jwt";
import { getAuthSecret, setSessionCookieOnResponse } from "@/lib/auth/session";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleOAuthConfig,
  getSiteOrigin,
  googleRedirectUri,
  sanitizeOAuthNextParam,
} from "@/lib/auth/googleOAuth";
import { validateEmail } from "@/lib/validateEmai";
import { runApiRoute } from "@/lib/api/runApiRoute";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function redirectWithClearedOauthCookies(req: NextRequest, path: string) {
  const origin = getSiteOrigin(req);
  const url = new URL(path, origin);
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const error = req.nextUrl.searchParams.get("error");
    if (error === "access_denied") {
      console.warn("[auth/google/callback] access_denied");
      return redirectWithClearedOauthCookies(req, "/login?error=google_denied");
    }
  
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const storedState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? "";
    const nextStored = sanitizeOAuthNextParam(req.cookies.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value ?? null);
  
    if (!code || !state || !storedState || state !== storedState) {
      console.warn("[auth/google/callback] state mismatch", {
        hasCode: Boolean(code),
        hasState: Boolean(state),
        hasStoredState: Boolean(storedState),
        stateMatch: Boolean(state && storedState && state === storedState),
      });
      return redirectWithClearedOauthCookies(req, "/login?error=google_state");
    }
  
    let config: ReturnType<typeof getGoogleOAuthConfig>;
    try {
      config = getGoogleOAuthConfig();
    } catch {
      return redirectWithClearedOauthCookies(req, "/login?error=google_config");
    }
  
    const redirectUri = googleRedirectUri(req);
  
    let accessToken: string;
    try {
      const tokens = await exchangeGoogleCode({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri,
      });
      accessToken = tokens.access_token;
    } catch (e) {
      console.error("[auth/google/callback] token exchange failed", e);
      return redirectWithClearedOauthCookies(req, "/login?error=google_token");
    }
  
    let profile: Awaited<ReturnType<typeof fetchGoogleUserInfo>>;
    try {
      profile = await fetchGoogleUserInfo(accessToken);
    } catch (e) {
      console.error("[auth/google/callback] profile fetch failed", e);
      return redirectWithClearedOauthCookies(req, "/login?error=google_profile");
    }
  
    const googleSub = profile.sub;
    const emailRaw = profile.email?.trim().toLowerCase() ?? "";
    if (!googleSub || !emailRaw || !profile.email_verified) {
      console.warn("[auth/google/callback] unverified or missing email", {
        hasSub: Boolean(googleSub),
        hasEmail: Boolean(emailRaw),
        emailVerified: profile.email_verified,
      });
      return redirectWithClearedOauthCookies(req, "/login?error=google_email");
    }
    if (!validateEmail(emailRaw)) {
      console.warn("[auth/google/callback] invalid email format", { emailRaw });
      return redirectWithClearedOauthCookies(req, "/login?error=google_email");
    }
  
    const nameFromGoogle =
      typeof profile.name === "string" && profile.name.trim() ? profile.name.trim().slice(0, 150) : null;
  
    try {
      const bySub = await prisma.customers.findUnique({
        where: { google_sub: googleSub },
        select: { id: true, email: true, google_sub: true, is_active: true },
      });
  
      let customerId: string;
      let customerEmail: string;
  
      if (bySub) {
        customerId = bySub.id;
        customerEmail = bySub.email;
        await prisma.customers.update({
          where: { id: bySub.id },
          data: { is_active: true },
        });
      } else {
        const byEmail = await prisma.customers.findUnique({
          where: { email: emailRaw },
          select: { id: true, email: true, google_sub: true, name: true, is_active: true },
        });
  
        if (byEmail) {
          if (byEmail.google_sub && byEmail.google_sub !== googleSub) {
            console.warn("[auth/google/callback] email linked to different Google account", {
              email: emailRaw,
            });
            return redirectWithClearedOauthCookies(req, "/login?error=google_link");
          }
          customerId = byEmail.id;
          customerEmail = byEmail.email;
          await prisma.customers.update({
            where: { id: byEmail.id },
            data: {
              google_sub: googleSub,
              is_active: true,
              ...(nameFromGoogle && !byEmail.name?.trim() ? { name: nameFromGoogle } : {}),
            },
          });
        } else {
          const randomPasswordHash = await bcrypt.hash(
            `${emailRaw}:${Date.now()}:${Math.random()}`,
            12
          );
          const created = await prisma.customers.create({
            data: {
              email: emailRaw,
              password_hash: randomPasswordHash,
              google_sub: googleSub,
              name: nameFromGoogle,
              is_active: true,
            },
            select: { id: true, email: true },
          });
          customerId = created.id;
          customerEmail = created.email;
        }
      }
  
      const token = signJwt(
        { sub: customerId, email: customerEmail, roles: [] },
        getAuthSecret(),
        SESSION_TTL_SECONDS
      );
  
      const dest = nextStored.startsWith("/login") ? "/" : nextStored;
      const res = redirectWithClearedOauthCookies(req, dest);
      setSessionCookieOnResponse(res, token, SESSION_TTL_SECONDS);
      console.info("[auth/google/callback] sign-in OK", { customerId, dest });
      return res;
    } catch (e) {
      console.error("[auth/google/callback] sign-in failed", e);
      return redirectWithClearedOauthCookies(req, "/login?error=google_failed");
    }
  
  });}
