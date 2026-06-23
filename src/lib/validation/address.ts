import { validateEmail } from "@/lib/validateEmai";
import {
  cleanOptionalText,
  cleanText,
  hasSuspiciousInput,
  normalizePhone,
} from "@/lib/validation/input";
import {
  indianMobileErrorMessage,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/lib/auth/indianMobile";
import type { FieldValidation } from "@/lib/validation/rules";

export type ValidatedShippingAddress = {
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** India PIN: 6 digits, first digit 1–9 (standard postal regions). */
const INDIAN_PIN_RE = /^[1-9]\d{5}$/;

export function isIndiaCountry(country: string): boolean {
  const c = country.trim().toLowerCase();
  return c === "india" || c === "in";
}

export function sanitizeIndianPinInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function normalizeIndianPostalCode(value: unknown): string | null {
  const digits = sanitizeIndianPinInput(String(value ?? ""));
  return INDIAN_PIN_RE.test(digits) ? digits : null;
}

export function containsEmailLikeText(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (text.includes("@")) return true;
  return validateEmail(text) !== null;
}

export function validateAddressTextField(
  value: unknown,
  label: string,
  options: { required?: boolean; maxLength?: number } = {}
): FieldValidation<string | null> {
  const required = options.required !== false;
  const maxLength = options.maxLength ?? 255;
  const text = required
    ? cleanText(value, maxLength)
    : (cleanOptionalText(value, maxLength) ?? null);

  if (required && !text) return { ok: false, error: `${label} is required` };
  if (text && containsEmailLikeText(text)) {
    return { ok: false, error: `${label} cannot be an email address` };
  }
  if (text && hasSuspiciousInput(text)) {
    return { ok: false, error: `Invalid characters in ${label.toLowerCase()}` };
  }
  return { ok: true, value: text };
}

export function validateIndianPostalCode(
  value: unknown,
  country: string
): FieldValidation<string> {
  const raw = cleanText(value, 20);
  if (!raw) return { ok: false, error: "PIN code is required" };

  if (isIndiaCountry(country)) {
    const pin = normalizeIndianPostalCode(raw);
    if (!pin) {
      return {
        ok: false,
        error: "Enter a valid 6-digit Indian PIN code (e.g. 560001). First digit cannot be 0.",
      };
    }
    return { ok: true, value: pin };
  }

  if (raw.length < 3 || raw.length > 20) {
    return { ok: false, error: "Enter a valid postal code" };
  }
  if (hasSuspiciousInput(raw)) {
    return { ok: false, error: "Invalid characters in postal code" };
  }
  return { ok: true, value: raw };
}

export function validateShippingAddress(
  body: Record<string, unknown>
): { ok: true; address: ValidatedShippingAddress } | { ok: false; error: string } {
  const country = cleanText(body.country ?? "India", 80) || "India";

  const fullName = validateAddressTextField(body.full_name, "Full name", {
    maxLength: 150,
  });
  if (!fullName.ok) return fail(fullName.error);

  const phoneDigits = normalizeIndianMobileDigits(body.phone);
  if (!phoneDigits || !isValidIndianMobile(phoneDigits)) {
    return fail(indianMobileErrorMessage());
  }

  const line1 = validateAddressTextField(body.line1, "Address line 1", { maxLength: 255 });
  if (!line1.ok) return fail(line1.error);

  const line2 = validateAddressTextField(body.line2, "Address line 2", {
    required: false,
    maxLength: 255,
  });
  if (!line2.ok) return fail(line2.error);

  const city = validateAddressTextField(body.city, "City", { maxLength: 120 });
  if (!city.ok) return fail(city.error);

  const state = validateAddressTextField(body.state, "State", { maxLength: 120 });
  if (!state.ok) return fail(state.error);

  const postal = validateIndianPostalCode(body.postal_code, country);
  if (!postal.ok) return fail(postal.error);

  const countryField = validateAddressTextField(country, "Country", { maxLength: 80 });
  if (!countryField.ok || !countryField.value) return fail("Country is required");

  return {
    ok: true,
    address: {
      full_name: fullName.value!,
      phone: normalizePhone(phoneDigits) || phoneDigits,
      line1: line1.value!,
      line2: line2.value,
      city: city.value!,
      state: state.value!,
      postal_code: postal.value,
      country: countryField.value,
    },
  };
}

/** Client-side helper — returns first validation error or null. */
export function getShippingAddressValidationError(
  address: Record<string, unknown>
): string | null {
  const result = validateShippingAddress(address);
  return result.ok ? null : result.error;
}
