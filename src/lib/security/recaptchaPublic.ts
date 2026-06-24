/** Client-safe reCAPTCHA helpers (site key only). */

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";

export function isRecaptchaEnabled(): boolean {
  return RECAPTCHA_SITE_KEY.length > 0;
}
