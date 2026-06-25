import "server-only";

const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";

/** Normalize a service-account PEM from .env (Hostinger, Vercel, local). */
export function normalizeGa4PrivateKey(raw: string): string {
  let key = raw.trim();

  // Strip surrounding quotes (single or double).
  for (let i = 0; i < 2; i++) {
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1).trim();
    }
  }

  // Unescape literal \n sequences (sometimes double-escaped on hosts).
  for (let i = 0; i < 3; i++) {
    const next = key.replace(/\\n/g, "\n");
    if (next === key) break;
    key = next;
  }

  // Collapsed single-line PEM (spaces instead of newlines).
  if (!key.includes("\n") && key.includes(PEM_BEGIN)) {
    key = key
      .replace(`${PEM_BEGIN} `, `${PEM_BEGIN}\n`)
      .replace(` ${PEM_END}`, `\n${PEM_END}`)
      .replace(PEM_BEGIN, `${PEM_BEGIN}\n`)
      .replace(PEM_END, `\n${PEM_END}`);
  }

  // Ensure header/footer are on their own lines.
  if (key.includes(PEM_BEGIN) && !key.startsWith(PEM_BEGIN)) {
    key = key.replace(PEM_BEGIN, `\n${PEM_BEGIN}`).trim();
  }
  if (key.includes(PEM_END) && !key.endsWith(PEM_END)) {
    key = key.replace(PEM_END, `${PEM_END}\n`).trim();
  }

  if (!key.includes(PEM_BEGIN) || !key.includes(PEM_END)) {
    throw new Error(
      "GA4_PRIVATE_KEY must include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----. " +
        "Copy the private_key value from your Google service account JSON file."
    );
  }

  return `${key.trim()}\n`;
}

export type Ga4Credentials = {
  clientEmail: string;
  privateKey: string;
  propertyId: string;
};

function stripJsonBom(raw: string): string {
  return raw.replace(/^\uFEFF/, "").trim();
}

/** Hostinger often breaks multi-line env values; pretty-printed JSON can be fixed by dropping real newlines. */
function parseServiceAccountJson(raw: string): { client_email?: string; private_key?: string } {
  const trimmed = stripJsonBom(raw);
  const attempts = [
    trimmed,
    trimmed.replace(/\r/g, "").replace(/\n/g, ""),
  ];

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

function hasSplitCredentials(): boolean {
  return Boolean(process.env.GA4_CLIENT_EMAIL?.trim() && process.env.GA4_PRIVATE_KEY?.trim());
}

function tryCredentialsFromJson(): { ok: true } | { ok: false; hint: string } {
  let jsonRaw: string | null = null;
  try {
    jsonRaw = readServiceAccountJsonFromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, hint: message };
  }

  if (!jsonRaw) {
    return { ok: false, hint: "" };
  }

  try {
    const account = parseServiceAccountJson(jsonRaw);
    if (account.client_email?.trim() && account.private_key?.trim()) {
      return { ok: true };
    }
    return { ok: false, hint: "GA4 JSON is missing client_email or private_key." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const truncated =
      jsonRaw.length < 200 && jsonRaw.startsWith("{")
        ? " Hostinger likely truncated multi-line JSON — delete GA4_SERVICE_ACCOUNT_JSON and use GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY, or minify to one line."
        : " Minify the JSON to a single line, or set GA4_SERVICE_ACCOUNT_JSON_BASE64.";
    return { ok: false, hint: message + truncated };
  }
}

export function getGa4ConfigStatus(): Ga4ConfigStatus {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) {
    return {
      configured: false,
      hint: "Set GA4_PROPERTY_ID (numeric GA4 property ID, not G-XXXX).",
    };
  }

  const fromJson = tryCredentialsFromJson();
  if (fromJson.ok) {
    return { configured: true, hint: null };
  }

  if (hasSplitCredentials()) {
    return { configured: true, hint: null };
  }

  if (fromJson.hint) {
    return {
      configured: false,
      hint:
        fromJson.hint +
        (process.env.GA4_SERVICE_ACCOUNT_JSON?.trim()
          ? " Or delete GA4_SERVICE_ACCOUNT_JSON and set GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY instead."
          : ""),
    };
  }

  return {
    configured: false,
    hint:
      "Set GA4_SERVICE_ACCOUNT_JSON (one-line minified JSON), GA4_SERVICE_ACCOUNT_JSON_BASE64, or GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY.",
  };
}

export function getGa4Credentials(): Ga4Credentials {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) {
    throw new Error("GA4_PROPERTY_ID is missing.");
  }

  let jsonError: string | null = null;
  try {
    const jsonRaw = readServiceAccountJsonFromEnv();
    if (jsonRaw) {
      const account = parseServiceAccountJson(jsonRaw);
      const clientEmail = account.client_email?.trim();
      const privateKeyRaw = account.private_key;
      if (!clientEmail || !privateKeyRaw) {
        jsonError = "GA4_SERVICE_ACCOUNT_JSON must include client_email and private_key.";
      } else {
        return {
          clientEmail,
          privateKey: normalizeGa4PrivateKey(privateKeyRaw),
          propertyId,
        };
      }
    }
  } catch (error) {
    jsonError = error instanceof Error ? error.message : String(error);
  }

  const clientEmail = process.env.GA4_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GA4_PRIVATE_KEY;
  if (clientEmail && privateKeyRaw?.trim()) {
    return {
      clientEmail,
      privateKey: normalizeGa4PrivateKey(privateKeyRaw),
      propertyId,
    };
  }

  throw new Error(
    jsonError ??
      "GA4 credentials missing. Set GA4_PROPERTY_ID plus either GA4_SERVICE_ACCOUNT_JSON, " +
        "GA4_SERVICE_ACCOUNT_JSON_BASE64, or GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY."
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
      "GA4 private key is invalid. In Hostinger, set GA4_PRIVATE_KEY as one line in double quotes " +
      'with \\n between lines, e.g. GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n". ' +
      "Or paste the full JSON into GA4_SERVICE_ACCOUNT_JSON."
    );
  }
  return message;
}
