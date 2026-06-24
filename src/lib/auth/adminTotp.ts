import "server-only";
import { generateSecret, generateURI, verify } from "otplib";
import { decryptAdminTotpSecret, encryptAdminTotpSecret } from "@/lib/auth/adminTotpCrypto";

const ISSUER = "i-Robox Admin";

export function createAdminTotpSetup(email: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: ISSUER,
    label: email,
    secret,
  });
  return { secret, otpauthUrl };
}

export async function verifyAdminTotpCode(secret: string, token: string): Promise<boolean> {
  const code = token.replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const result = await verify({ secret, token: code });
  return Boolean(result.valid);
}

export function encryptTotpSecretForStorage(secret: string): string {
  return encryptAdminTotpSecret(secret);
}

export async function verifyStoredAdminTotpCode(
  encryptedSecret: string | null | undefined,
  token: string
): Promise<boolean> {
  if (!encryptedSecret) return false;
  const secret = decryptAdminTotpSecret(encryptedSecret);
  if (!secret) return false;
  return verifyAdminTotpCode(secret, token);
}
