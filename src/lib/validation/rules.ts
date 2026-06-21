import { validateEmail, validateCommonEmailProvider } from "@/lib/validateEmai";
import {
  cleanOptionalHexColor,
  cleanOptionalText,
  cleanText,
  hasSuspiciousInput,
  isUuid,
  normalizeEmail,
} from "@/lib/validation/input";
import {
  indianMobileErrorMessage,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/lib/auth/indianMobile";

export type FieldValidation<T> = { ok: true; value: T } | { ok: false; error: string };

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const REVIEW_COMMENT_MAX = 2000;
export const REVIEW_COMMENT_MIN = 1;
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const MAX_CART_PREVIEW_ITEMS = 50;
export const MAX_CONTACT_MESSAGE_LENGTH = 1800;
export const NAME_MAX_LENGTH = 150;

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function validateRequiredText(
  value: unknown,
  maxLength: number,
  label = "This field"
): FieldValidation<string> {
  const text = cleanText(value, maxLength);
  if (!text) return fail(`${label} is required`);
  if (hasSuspiciousInput(text)) return fail("Invalid characters in input");
  return { ok: true, value: text };
}

export function validateOptionalText(
  value: unknown,
  maxLength: number
): FieldValidation<string | null> {
  const text = cleanOptionalText(value, maxLength);
  if (text && hasSuspiciousInput(text)) return fail("Invalid characters in input");
  return { ok: true, value: text };
}

export function validateEmailAddress(
  value: unknown,
  options: { required?: boolean; commonProviderOnly?: boolean } = {}
): FieldValidation<string> {
  const required = options.required !== false;
  const email = normalizeEmail(value);
  if (!email) {
    return required ? fail("Email is required") : { ok: true, value: "" };
  }
  if (!validateEmail(email)) return fail("Enter a valid email address");
  if (options.commonProviderOnly && !validateCommonEmailProvider(email)) {
    return fail("Use a common email provider (Gmail, Yahoo, Outlook, etc.)");
  }
  if (hasSuspiciousInput(email)) return fail("Invalid email address");
  return { ok: true, value: email };
}

export function validateOptionalEmailAddress(value: unknown): FieldValidation<string | null> {
  if (value === null || value === "") return { ok: true, value: null };
  const email = normalizeEmail(value);
  if (!email || !validateEmail(email)) return fail("Enter a valid email address");
  if (hasSuspiciousInput(email)) return fail("Invalid email address");
  return { ok: true, value: email };
}

export function validatePassword(value: unknown): FieldValidation<string> {
  const password = typeof value === "string" ? value : "";
  if (!password) return fail("Password is required");
  if (password.length < PASSWORD_MIN_LENGTH) {
    return fail(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return fail(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }
  return { ok: true, value: password };
}

export function validateIndianMobileNumber(value: unknown): FieldValidation<string> {
  const digits = normalizeIndianMobileDigits(value);
  if (!digits || !isValidIndianMobile(digits)) {
    return fail(indianMobileErrorMessage());
  }
  return { ok: true, value: digits };
}

export function validateOptionalIndianMobile(value: unknown): FieldValidation<string | null> {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  return validateIndianMobileNumber(value);
}

export function validateOtpCode(value: unknown): FieldValidation<string> {
  const otp = cleanText(value, 10);
  if (!/^\d{6}$/.test(otp)) return fail("Enter a valid 6-digit OTP");
  return { ok: true, value: otp };
}

export function validateUuid(value: unknown, label = "ID"): FieldValidation<string> {
  const id = cleanText(value, 64);
  if (!id || !isUuid(id)) return fail(`Invalid ${label}`);
  return { ok: true, value: id };
}

export function validateStarRating(value: unknown): FieldValidation<number> {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX) {
    return fail(`Rating must be between ${REVIEW_RATING_MIN} and ${REVIEW_RATING_MAX}`);
  }
  return { ok: true, value: rating };
}

export function validateReviewComment(value: unknown): FieldValidation<string> {
  const comment = cleanText(value, REVIEW_COMMENT_MAX);
  if (comment.length < REVIEW_COMMENT_MIN) return fail("Comment is required");
  if (hasSuspiciousInput(comment)) return fail("Invalid characters in comment");
  return { ok: true, value: comment };
}

export function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedHref(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value.length <= 500 && !hasSuspiciousInput(value);
  }
  return isHttpOrHttpsUrl(value);
}

export function validateOptionalHttpUrl(value: unknown): FieldValidation<string | null> {
  if (value === null || value === "") return { ok: true, value: null };
  const url = cleanText(value, 500);
  if (!url) return { ok: true, value: null };
  if (!isHttpOrHttpsUrl(url)) return fail("Enter a valid http or https URL");
  if (hasSuspiciousInput(url)) return fail("Invalid URL");
  return { ok: true, value: url };
}

export function validateHttpUrl(value: unknown): FieldValidation<string> {
  const url = cleanText(value, 500);
  if (!url) return fail("URL is required");
  if (!isHttpOrHttpsUrl(url)) return fail("Enter a valid http or https URL");
  if (hasSuspiciousInput(url)) return fail("Invalid URL");
  return { ok: true, value: url };
}

export function validateOptionalHref(value: unknown): FieldValidation<string | null> {
  if (value === null || value === "") return { ok: true, value: null };
  const href = cleanText(value, 500);
  if (!href) return { ok: true, value: null };
  if (!isAllowedHref(href)) return fail("Enter a valid link (path or URL)");
  return { ok: true, value: href };
}

export function validateOptionalHexColor(value: unknown): FieldValidation<string | null> {
  if (value === null || value === "") return { ok: true, value: null };
  const color = cleanOptionalHexColor(value);
  if (!color) return fail("Enter a valid hex color (#rgb or #rrggbb)");
  return { ok: true, value: color };
}

export function validatePositiveInt(
  value: unknown,
  max = 1_000_000,
  label = "Value"
): FieldValidation<number> {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) return fail(`Invalid ${label}`);
  return { ok: true, value: n };
}

export function validateNonNegativeNumber(
  value: unknown,
  max = 10_000_000,
  label = "Value"
): FieldValidation<number> {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return fail(`Invalid ${label}`);
  return { ok: true, value: n };
}

export function validateCouponDiscount(
  discountType: string,
  discountValue: number
): FieldValidation<number> {
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return fail("Discount value must be greater than 0");
  }
  if (discountType === "PERCENTAGE" && discountValue > 100) {
    return fail("Percentage discount cannot exceed 100");
  }
  if (discountType === "FIXED" && discountValue > 10_000_000) {
    return fail("Discount amount is too large");
  }
  return { ok: true, value: discountValue };
}

export function validateContactMessage(value: unknown): FieldValidation<string> {
  const message = cleanText(value, MAX_CONTACT_MESSAGE_LENGTH);
  if (!message) return fail("Message is required");
  if (hasSuspiciousInput(message)) return fail("Invalid characters in message");
  return { ok: true, value: message };
}
