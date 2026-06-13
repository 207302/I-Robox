import {
  cleanOptionalText,
  cleanText,
  hasSuspiciousInput,
  normalizePhone,
} from "@/lib/validation/input";

export type ParsedAddressInput = {
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

export function parseAddressInput(
  body: Record<string, unknown>
): { ok: true; address: ParsedAddressInput } | { ok: false; error: string } {
  const full_name = cleanText(body.full_name, 150);
  const phone = normalizePhone(body.phone);
  const line1 = cleanText(body.line1, 255);
  const line2 = cleanOptionalText(body.line2, 255);
  const city = cleanText(body.city, 120);
  const state = cleanText(body.state, 120);
  const postal_code = cleanText(body.postal_code, 20);
  const country = cleanText(body.country ?? "India", 80);

  if (!full_name || !phone || !line1 || !city || !state || !postal_code || !country) {
    return { ok: false, error: "Please fill in all required address fields" };
  }

  const fields = [full_name, phone, line1, line2 ?? "", city, state, postal_code, country];
  if (fields.some((f) => hasSuspiciousInput(f))) {
    return { ok: false, error: "Invalid input" };
  }

  return {
    ok: true,
    address: { full_name, phone, line1, line2, city, state, postal_code, country },
  };
}
