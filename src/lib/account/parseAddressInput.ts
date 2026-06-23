import {
  validateShippingAddress,
  type ValidatedShippingAddress,
} from "@/lib/validation/address";

export type ParsedAddressInput = ValidatedShippingAddress;

export function parseAddressInput(
  body: Record<string, unknown>
): { ok: true; address: ParsedAddressInput } | { ok: false; error: string } {
  return validateShippingAddress(body);
}
