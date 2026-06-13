import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/validation/input";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";

export function isValidPhoneDigits(normalizedPhone: string) {
  return /^\+?[0-9]{7,15}$/.test(normalizedPhone.replace(/\s+/g, ""));
}

/** Common stored formats for the same Indian / international number. */
export function phoneLookupVariants(value: unknown): string[] {
  const normalized = normalizePhone(value);
  if (!normalized) return [];
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>([normalized]);
  if (digits) variants.add(digits);
  if (digits.length === 10) {
    variants.add(`+91${digits}`);
    variants.add(`91${digits}`);
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(2));
    variants.add(`+91${digits.slice(2)}`);
  }
  return [...variants];
}

export async function findCustomerPhoneConflict(
  phone: string,
  excludeCustomerId?: string
): Promise<{ id: string; email: string } | null> {
  const variants = phoneLookupVariants(phone);
  if (variants.length === 0) return null;

  const existing = await prisma.customers.findFirst({
    where: {
      phone: { in: variants },
      ...(excludeCustomerId ? { NOT: { id: excludeCustomerId } } : {}),
    },
    select: { id: true, email: true },
  });
  return existing;
}

export function phoneConflictErrorMessage(): string {
  return "This mobile number is linked to another Gmail account.";
}

export function displayEmailForCustomer(email: string): string | null {
  return isSyntheticPhoneSignupEmail(email) ? null : email;
}
