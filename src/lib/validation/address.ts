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

function normalizeAddressCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Reject common field mix-ups (phone in line2, full address in city, etc.). */
export function validateAddressFieldConsistency(
  address: ValidatedShippingAddress
): { ok: true } | { ok: false; error: string } {
  const line1 = normalizeAddressCompare(address.line1);
  const line2 = address.line2?.trim() ?? "";
  const city = normalizeAddressCompare(address.city);
  const state = normalizeAddressCompare(address.state);
  const postalLower = address.postal_code.trim().toLowerCase();
  const phoneDigits = normalizeIndianMobileDigits(address.phone);

  if (line1 && city && line1 === city) {
    return fail("City cannot be the same as address line 1. Enter the city name only.");
  }

  if (city && postalLower === city) {
    return fail("PIN code cannot be the same as the city name. Enter a valid 6-digit PIN.");
  }

  if (state && postalLower === state) {
    return fail("PIN code cannot be the same as the state name.");
  }

  if (line2) {
    const line2Mobile = normalizeIndianMobileDigits(line2);
    if (line2Mobile && isValidIndianMobile(line2Mobile)) {
      return fail("Address line 2 cannot be a phone number. Enter it in the phone field.");
    }
    if (phoneDigits && line2Mobile && line2Mobile === phoneDigits) {
      return fail("Address line 2 cannot repeat the phone number.");
    }
  }

  const cityTrimmed = address.city.trim();
  if (cityTrimmed.length > 40) {
    return fail("City name is too long. Enter the city only, not the full street address.");
  }

  if (cityTrimmed.split(/\s+/).filter(Boolean).length > 5) {
    return fail("City should be a city name only, not a full street address.");
  }

  if (isIndiaCountry(address.country) && /^\d+$/.test(cityTrimmed)) {
    return fail("Enter a valid city name.");
  }

  return { ok: true };
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

  const validated: ValidatedShippingAddress = {
    full_name: fullName.value!,
    phone: normalizePhone(phoneDigits) || phoneDigits,
    line1: line1.value!,
    line2: line2.value,
    city: city.value!,
    state: state.value!,
    postal_code: postal.value,
    country: countryField.value,
  };

  const consistency = validateAddressFieldConsistency(validated);
  if (!consistency.ok) return consistency;

  return { ok: true, address: validated };
}

/** True when a stored address row can be used for checkout / account display. */
export function isShippingAddressValid(body: Record<string, unknown>): boolean {
  return validateShippingAddress(body).ok;
}

/** Client-side helper — returns first validation error or null. */
export function getShippingAddressValidationError(
  address: Record<string, unknown>
): string | null {
  const result = validateShippingAddress(address);
  return result.ok ? null : result.error;
}
