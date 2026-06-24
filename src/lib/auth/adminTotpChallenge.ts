import "server-only";
import crypto from "crypto";
import { getAuthSecret } from "@/lib/auth/session";

const CHALLENGE_TTL_SECONDS = 5 * 60;

export type AdminTotpChallengePayload = {
  sub: string;
  purpose: "admin_totp";
  iat: number;
  exp: number;
};

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const pad = 4 - (input.length % 4 || 4);
  const normalized = (input + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

export function signAdminTotpChallenge(adminId: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: AdminTotpChallengePayload = {
    sub: adminId,
    purpose: "admin_totp",
    iat: now,
    exp: now + CHALLENGE_TTL_SECONDS,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(data).digest();
  return `${data}.${base64UrlEncode(signature)}`;
}

export function verifyAdminTotpChallenge(token: string): AdminTotpChallengePayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto.createHmac("sha256", getAuthSecret()).update(data).digest();
  const actualSig = base64UrlDecode(encodedSig);
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8")
    ) as AdminTotpChallengePayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== "admin_totp" || !payload.sub || !payload.exp || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
