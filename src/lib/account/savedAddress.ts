import { sanitizeIndianPhoneInput } from "@/lib/auth/indianMobile";

export type SavedAddressRecord = {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  isPrimary: boolean;
};

export type CheckoutAddressFields = {
  full_name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

export function mapDbAddressToSaved(
  row: {
    id: string;
    full_name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_default_shipping: boolean;
  }
): SavedAddressRecord {
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    isPrimary: row.is_default_shipping,
  };
}

export function savedAddressToCheckoutFields(
  addr: Pick<
    SavedAddressRecord,
    "full_name" | "phone" | "line1" | "line2" | "city" | "state" | "postal_code" | "country"
  >,
  email: string
): CheckoutAddressFields {
  return {
    full_name: addr.full_name,
    email,
    phone: sanitizeIndianPhoneInput(addr.phone),
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    state: addr.state,
    postal_code: addr.postal_code,
    country: addr.country,
  };
}

export function formatSavedAddressLabel(addr: SavedAddressRecord): string {
  const parts = [addr.full_name, addr.city, addr.postal_code].filter(Boolean);
  return parts.join(" · ");
}
