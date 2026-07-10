/**
 * Print Hostinger-ready GA4 env vars from a Google service account JSON key file.
 *
 * Usage:
 *   node scripts/ga4-hostinger-env.mjs path/to/service-account.json
 */
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/ga4-hostinger-env.mjs <service-account.json>");
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(file), "utf8");
let account;
try {
  account = JSON.parse(raw);
} catch {
  console.error("File is not valid JSON. Download a fresh key from Google Cloud Console.");
  process.exit(1);
}

const clientEmail = account.client_email?.trim();
const privateKey = account.private_key?.trim();
if (!clientEmail || !privateKey) {
  console.error("JSON is missing client_email or private_key.");
  process.exit(1);
}

const privateKeyOneLine = privateKey.replace(/\r?\n/g, "\\n");
const minified = JSON.stringify(account);
const base64 = Buffer.from(minified, "utf8").toString("base64");

console.log("Hostinger → Websites → Node.js → your app → Environment variables\n");
console.log("Recommended on Hostinger: delete GA4_PRIVATE_KEY and GA4_SERVICE_ACCOUNT_JSON, then set:\n");
console.log(`GA4_SERVICE_ACCOUNT_JSON_BASE64=${base64}`);
console.log("\nAlternative — split fields:\n");
console.log(`GA4_CLIENT_EMAIL=${clientEmail}`);
console.log(`GA4_PRIVATE_KEY="${privateKeyOneLine}"`);
