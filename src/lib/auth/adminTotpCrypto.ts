import "server-only";
import crypto from "crypto";
import { getAuthSecret } from "@/lib/auth/session";

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(`${getAuthSecret()}:admin-totp-v1`).digest();
}

export function encryptAdminTotpSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(
    "."
  );
}

export function decryptAdminTotpSecret(payload: string): string | null {
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0]!, "base64url");
    const tag = Buffer.from(parts[1]!, "base64url");
    const data = Buffer.from(parts[2]!, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
