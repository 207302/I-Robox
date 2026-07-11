/**
 * Smoke-test Cloudinary credentials (same vars as bulk upload).
 *
 * Local: loads .env.local if present.
 *   node scripts/test-cloudinary-upload.mjs
 *
 * Hostinger: set CLOUDINARY_* in hPanel env vars, redeploy, then SSH:
 *   node scripts/test-cloudinary-upload.mjs
 */
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

const root = path.resolve(import.meta.dirname, "..");
const envLocal = path.join(root, ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const required = [
  "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missing = required.filter((k) => !String(process.env[k] ?? "").trim());
if (missing.length) {
  console.error("[test-cloudinary-upload] Missing env:", missing.join(", "));
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.info("[test-cloudinary-upload] cloud:", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

try {
  const ping = await cloudinary.api.ping();
  console.info("[test-cloudinary-upload] ping:", ping);

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const uploaded = await cloudinary.uploader.upload(
    `data:image/png;base64,${tinyPng.toString("base64")}`,
    { folder: "irobox/media", resource_type: "image", tags: ["upload-test"] }
  );
  console.info("[test-cloudinary-upload] upload ok:", uploaded.secure_url);
  if (uploaded.public_id) {
    await cloudinary.uploader.destroy(uploaded.public_id).catch(() => null);
    console.info("[test-cloudinary-upload] cleaned up test image");
  }
  console.info("[test-cloudinary-upload] SUCCESS");
} catch (err) {
  console.error("[test-cloudinary-upload] FAILED", err);
  process.exit(1);
}
