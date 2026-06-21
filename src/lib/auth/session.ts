import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE_NAME, AUTH_COOKIE_NAME } from "@/lib/auth/cookieNames";
import { verifyJwt, type JwtPayload } from "./jwt";

export { AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME } from "@/lib/auth/cookieNames";

export function getAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJwt(token, getAuthSecret());
}

export async function getAdminSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJwt(token, getAuthSecret());
}

const sessionCookieOptions = (maxAgeSeconds: number) => ({
  name: AUTH_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

const adminSessionCookieOptions = (maxAgeSeconds: number) => ({
  name: ADMIN_AUTH_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

const clearedCookieFields = {
  value: "",
  maxAge: 0,
  expires: new Date(0),
} as const;

export async function setSessionCookie(token: string, maxAgeSeconds: number) {
  const cookieStore = await cookies();
  cookieStore.set({
    ...sessionCookieOptions(maxAgeSeconds),
    value: token,
  });
}

/** Use when the response is a redirect so the session cookie is on the same response. */
export function setSessionCookieOnResponse(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
) {
  response.cookies.set({
    ...sessionCookieOptions(maxAgeSeconds),
    value: token,
  });
}

export async function setAdminSessionCookie(token: string, maxAgeSeconds: number) {
  const cookieStore = await cookies();
  cookieStore.set({
    ...adminSessionCookieOptions(maxAgeSeconds),
    value: token,
  });
}

/** Attach cleared session cookie to a route-handler response (reliable vs cookies().set alone). */
export function clearSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set({
    ...sessionCookieOptions(0),
    ...clearedCookieFields,
  });
}

export function clearAdminSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set({
    ...adminSessionCookieOptions(0),
    ...clearedCookieFields,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    ...sessionCookieOptions(0),
    ...clearedCookieFields,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    ...adminSessionCookieOptions(0),
    ...clearedCookieFields,
  });
}

