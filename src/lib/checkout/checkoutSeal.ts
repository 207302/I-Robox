import crypto from "crypto";
import type { CheckoutContext } from "@/lib/checkout/buildCheckoutContext";

const SEAL_TTL_MS = 45 * 60_000;

type SealedPayload = {
  v: 1;
  exp: number;
  razorpayOrderId: string;
  ctx: CheckoutContext;
};

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from((input + pad).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Signed checkout snapshot from `/razorpay/order` — avoids re-running full checkout on verify. */
export function sealCheckoutContext(razorpayOrderId: string, ctx: CheckoutContext): string {
  const payload: SealedPayload = {
    v: 1,
    exp: Date.now() + SEAL_TTL_MS,
    razorpayOrderId,
    ctx,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getSecret()).update(`checkout:${encoded}`).digest();
  return `${encoded}.${base64UrlEncode(sig)}`;
}

export function unsealCheckoutContext(
  seal: string,
  razorpayOrderId: string
): CheckoutContext | null {
  const parts = seal.split(".");
  if (parts.length !== 2) return null;
  const [encoded, encodedSig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(`checkout:${encoded}`)
    .digest();
  const actualSig = base64UrlDecode(encodedSig);
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded).toString("utf8")) as SealedPayload;
    if (payload.v !== 1 || payload.razorpayOrderId !== razorpayOrderId) return null;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.ctx?.lineItems?.length || typeof payload.ctx.total !== "number") return null;
    return payload.ctx;
  } catch {
    return null;
  }
}
