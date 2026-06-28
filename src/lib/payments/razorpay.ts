import crypto from "crypto";
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";

export function isRazorpayConfigured() {
  return Boolean(keyId && keySecret);
}

export function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function razorpayPublicConfig() {
  if (!keyId) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  return { keyId };
}

export function verifyRazorpayPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  if (!keySecret) return false;
  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const digest = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  return digest === input.razorpaySignature;
}

export function isRazorpayWebhookSecretConfigured() {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim());
}

/** Logs at startup when refund webhooks cannot verify signatures. */
export function warnRazorpayWebhookSecretMissing() {
  if (isRazorpayWebhookSecretConfigured()) return;
  console.error(
    "[razorpay] RAZORPAY_WEBHOOK_SECRET is not set — refund webhooks will fail signature verification. " +
      "Copy the webhook secret from Razorpay Dashboard → Account & Settings → Webhooks and set it in your environment."
  );
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
}) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) return false;
  const digest = crypto.createHmac("sha256", webhookSecret).update(input.rawBody).digest("hex");
  return digest === input.signature;
}
