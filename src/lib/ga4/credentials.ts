import "server-only";

import { createPrivateKey } from "node:crypto";

const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";

function rewrapPkcs8PrivateKey(key: string): string {
  const begin = key.indexOf(PEM_BEGIN);
  const end = key.indexOf(PEM_END);
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error(
      "GA4_PRIVATE_KEY must include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----."
    );
  }

  const body = key
    .slice(begin + PEM_BEGIN.length, end)
    .replace(/\\n/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "");

  if (body.length < 500) {
    throw new Error(
      "GA4_PRIVATE_KEY looks truncated. Copy the full private_key from your service account JSON."
    );
  }

  const lines = [PEM_BEGIN];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.slice(i, i + 64));
  }
  lines.push(PEM_END);
  return `${lines.join("\n")}\n`;
}

/** Normalize a service-account PEM from .env (Hostinger, Vercel, local). */
export function normalizeGa4PrivateKey(raw: string): string {
  let key = raw.trim();

  for (let i = 0; i < 2; i++) {
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1).trim();
    }
  }

  for (let i = 0; i < 3; i++) {
    const next = key.replace(/\\n/g, "\n");
    if (next === key) break;
    key = next;
  }

  const pem = rewrapPkcs8PrivateKey(key);

  try {
    createPrivateKey(pem);
  } catch {
    throw new Error(
      "GA4_PRIVATE_KEY is not a valid PEM private key. On Hostinger, use GA4_SERVICE_ACCOUNT_JSON_BASE64 instead."
    );
  }

  return pem;
}

function normalizeGa4PropertyId(raw: string): string {
  let id = stripEnvWrappingQuotes(raw.trim());
  id = id.replace(/^properties\//i, "");
  if (/^G-/i.test(id)) {
    throw new Error("GA4_PROPERTY_ID must be the numeric property ID, not a G-XXXX measurement ID.");
  }
  if (!/^\d+$/.test(id)) {
    throw new Error(
      `GA4_PROPERTY_ID must be digits only (e.g. 542443804). Check Hostinger env — got "${id.slice(0, 24)}".`
    );
  }
  return id;
}

export type Ga4Credentials = {
  clientEmail: string;
  privateKey: string;
  propertyId: string;
};

function stripJsonBom(raw: string): string {
  return raw.replace(/^\uFEFF/, "").trim();
}

function stripEnvWrappingQuotes(raw: string): string {
  let value = raw.trim();
  for (let i = 0; i < 2; i++) {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
  }
  return value;
}

function normalizeJsonCandidate(raw: string): string {
  return stripEnvWrappingQuotes(stripJsonBom(raw))
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/** Hostinger often breaks multi-line env values; pretty-printed JSON can be fixed by dropping real newlines. */
function parseServiceAccountJson(raw: string): { client_email?: string; private_key?: string } {
  const trimmed = normalizeJsonCandidate(raw);
  const attempts = new Set<string>([
    trimmed,
    trimmed.replace(/\r/g, "").replace(/\n/g, ""),
  ]);

  for (const candidate of attempts) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start && (start > 0 || end < candidate.length - 1)) {
      attempts.add(candidate.slice(start, end + 1));
      attempts.add(candidate.slice(start, end + 1).replace(/\r/g, "").replace(/\n/g, ""));
    }
  }

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as { client_email?: string; private_key?: string };
    } catch {
      // try next normalization
    }
  }

  throw new Error(
    "GA4_SERVICE_ACCOUNT_JSON is not valid JSON. On Hostinger, paste the file as one minified line " +
      "(no line breaks), or use GA4_SERVICE_ACCOUNT_JSON_BASE64 instead."
  );
}

function readServiceAccountJsonFromEnv(): string | null {
  const base64 = process.env.GA4_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (base64) {
    try {
      return Buffer.from(base64, "base64").toString("utf8");
    } catch {
      throw new Error("GA4_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64.");
    }
  }

  const jsonRaw = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  return jsonRaw || null;
}

export type Ga4ConfigStatus = {
  configured: boolean;
  hint: string | null;
};

/** Safe diagnostics for admin (no secrets). */
export function getGa4ConfigDiagnostics(): Ga4ConfigStatus & {
  hasPropertyId: boolean;
  hasJsonEnv: boolean;
  jsonLength: number;
  hasBase64Env: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
} {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const jsonEnv = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim() ?? "";
  const base64Env = process.env.GA4_SERVICE_ACCOUNT_JSON_BASE64?.trim() ?? "";
  const status = getGa4ConfigStatus();

  return {
    ...status,
    hasPropertyId: Boolean(propertyId),
    hasJsonEnv: Boolean(jsonEnv),
    jsonLength: jsonEnv.length,
    hasBase64Env: Boolean(base64Env),
    hasClientEmail: Boolean(process.env.GA4_CLIENT_EMAIL?.trim()),
    hasPrivateKey: Boolean(process.env.GA4_PRIVATE_KEY?.trim()),
  };
}

function credentialsFromJsonEnv(): Ga4Credentials | null {
  const propertyIdRaw = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyIdRaw) return null;
  const propertyId = normalizeGa4PropertyId(propertyIdRaw);

  const jsonRaw = readServiceAccountJsonFromEnv();
  if (!jsonRaw) return null;

  const account = parseServiceAccountJson(jsonRaw);
  const clientEmail = account.client_email?.trim();
  const privateKeyRaw = account.private_key;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("GA4 service account JSON is missing client_email or private_key.");
  }

  return {
    clientEmail,
    privateKey: normalizeGa4PrivateKey(privateKeyRaw),
    propertyId: normalizeGa4PropertyId(propertyId),
  };
}

export function getGa4ConfigStatus(): Ga4ConfigStatus {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) {
    return {
      configured: false,
      hint: "Set GA4_PROPERTY_ID (numeric GA4 property ID, not G-XXXX).",
    };
  }

  try {
    getGa4Credentials();
    return { configured: true, hint: null };
  } catch (error) {
    return {
      configured: false,
      hint: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getGa4Credentials(): Ga4Credentials {
  const propertyIdRaw = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyIdRaw) {
    throw new Error("GA4_PROPERTY_ID is missing.");
  }
  const propertyId = normalizeGa4PropertyId(propertyIdRaw);

  let jsonError: string | null = null;
  try {
    const fromJson = credentialsFromJsonEnv();
    if (fromJson) return fromJson;
  } catch (error) {
    jsonError = error instanceof Error ? error.message : String(error);
  }

  const clientEmail = process.env.GA4_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GA4_PRIVATE_KEY;
  if (clientEmail && privateKeyRaw?.trim()) {
    try {
      return {
        clientEmail,
        privateKey: normalizeGa4PrivateKey(privateKeyRaw),
        propertyId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        jsonError
          ? `${message} (${jsonError})`
          : `${message} Delete GA4_PRIVATE_KEY and set GA4_SERVICE_ACCOUNT_JSON_BASE64 on Hostinger.`
      );
    }
  }

  throw new Error(
    jsonError ??
      "GA4 credentials missing. Set GA4_PROPERTY_ID plus GA4_SERVICE_ACCOUNT_JSON_BASE64, GA4_SERVICE_ACCOUNT_JSON, or GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY."
  );
}

export function isGa4Configured(): boolean {
  return getGa4ConfigStatus().configured;
}

export function formatGa4CredentialError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("PEM routines") ||
    message.includes("no start line") ||
    message.includes("DECODER routines")
  ) {
    return (
      "GA4 private key is invalid on the server. On Hostinger: delete GA4_PRIVATE_KEY, set " +
      "GA4_SERVICE_ACCOUNT_JSON_BASE64 from `node scripts/ga4-hostinger-env.mjs your-key.json`, then redeploy."
    );
  }
  return message;
}
