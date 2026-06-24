import "server-only";
import { cleanText } from "@/lib/validation/input";

export function isRecaptchaConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() &&
      process.env.RECAPTCHA_SECRET_KEY?.trim()
  );
}

type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyRecaptchaToken(
  token: string | undefined,
  remoteIp?: string
): Promise<VerifyResult> {
  if (!isRecaptchaConfigured()) return { ok: true };

  const response = cleanText(token, 4096);
  if (!response) {
    return { ok: false, error: "Please complete the reCAPTCHA check." };
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY!.trim();
  const params = new URLSearchParams({ secret, response });
  const ip = remoteIp?.trim();
  if (ip) params.set("remoteip", ip);

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) return { ok: true };

    return {
      ok: false,
      error: "reCAPTCHA verification failed. Please try again.",
    };
  } catch {
    return { ok: false, error: "Could not verify reCAPTCHA. Please try again." };
  }
}

export async function requireRecaptchaFromBody(
  body: Record<string, unknown>,
  remoteIp?: string
): Promise<VerifyResult> {
  const token = typeof body.recaptchaToken === "string" ? body.recaptchaToken : undefined;
  return verifyRecaptchaToken(token, remoteIp);
}
