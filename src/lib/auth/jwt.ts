import crypto from "crypto";

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const pad = 4 - (input.length % 4 || 4);
  const normalized = (input + "=".repeat(pad))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

export type JwtPayload = {
  /** customers.id for storefront JWT; admin_users.id for admin JWT */
  sub: string;
  /** Masked email only — never store or trust the raw address from the token. */
  email: string;
  roles: string[];
  iat: number;
  exp: number;
};

/** Redact email before it is embedded in a JWT payload (token body is only base64-encoded). */
export function maskEmailForJwt(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "";
  if (trimmed.includes("*")) return trimmed;

  const at = trimmed.indexOf("@");
  if (at < 1) return "***";

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return `${local[0] ?? ""}***@***`;

  const maskedLocal =
    local.length <= 1
      ? "*"
      : local.length === 2
        ? `${local[0]}*`
        : `${local[0]}${"*".repeat(Math.min(3, local.length - 2))}${local.slice(-1)}`;

  const lastDot = domain.lastIndexOf(".");
  if (lastDot <= 0) {
    return `${maskedLocal}@${domain[0] ?? ""}***`;
  }

  const domainLabel = domain.slice(0, lastDot);
  const tld = domain.slice(lastDot);
  const maskedDomain =
    domainLabel.length <= 1
      ? "*"
      : `${domainLabel[0]}${"*".repeat(Math.min(3, domainLabel.length - 1))}`;

  return `${maskedLocal}@${maskedDomain}${tld}`;
}

export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, secret: string, ttlSeconds: number) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = {
    ...payload,
    email: maskEmailForJwt(payload.email),
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest();
  return `${data}.${base64UrlEncode(signature)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest();
  const actualSig = base64UrlDecode(encodedSig);
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return null;
    if (typeof payload.email === "string") {
      payload.email = maskEmailForJwt(payload.email);
    }
    return payload;
  } catch {
    return null;
  }
}

