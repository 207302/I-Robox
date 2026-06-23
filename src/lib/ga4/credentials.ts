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

function parseServiceAccountJson(raw: string): { client_email?: string; private_key?: string } {
  try {
    return JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    throw new Error(
      "GA4_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full service account key file contents."
    );
  }
}

export function getGa4Credentials(): Ga4Credentials {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) {
    throw new Error("GA4_PROPERTY_ID is missing.");
  }

  const jsonRaw = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const account = parseServiceAccountJson(jsonRaw);
    const clientEmail = account.client_email?.trim();
    const privateKeyRaw = account.private_key;
    if (!clientEmail || !privateKeyRaw) {
      throw new Error("GA4_SERVICE_ACCOUNT_JSON must include client_email and private_key.");
    }
    return {
      clientEmail,
      privateKey: normalizeGa4PrivateKey(privateKeyRaw),
      propertyId,
    };
  }

  const clientEmail = process.env.GA4_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GA4_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw?.trim()) {
    throw new Error(
      "GA4 credentials missing. Set GA4_PROPERTY_ID plus either GA4_SERVICE_ACCOUNT_JSON or " +
        "GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY."
    );
  }

  return {
    clientEmail,
    privateKey: normalizeGa4PrivateKey(privateKeyRaw),
    propertyId,
  };
}

export function isGa4Configured(): boolean {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) return false;

  const jsonRaw = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const account = parseServiceAccountJson(jsonRaw);
      return Boolean(account.client_email?.trim() && account.private_key?.trim());
    } catch {
      return false;
    }
  }

  return Boolean(process.env.GA4_CLIENT_EMAIL?.trim() && process.env.GA4_PRIVATE_KEY?.trim());
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
