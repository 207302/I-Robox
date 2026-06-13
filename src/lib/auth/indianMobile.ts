import { normalizePhone } from "@/lib/validation/input";

/** Normalize input to 10-digit Indian mobile (no country code). */
export function normalizeIndianMobileDigits(value: unknown): string | null {
  const normalized = normalizePhone(value);
  if (!normalized) return null;

  let digits = normalized.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return null;
  return digits;
}

/** Valid Indian mobile: 10 digits starting with 6, 7, 8, or 9. */
export function isValidIndianMobile(value: unknown): boolean {
  const digits = normalizeIndianMobileDigits(value);
  if (!digits) return false;
  return /^[6-9]\d{9}$/.test(digits);
}

export function indianMobileErrorMessage(): string {
  return "Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).";
}
