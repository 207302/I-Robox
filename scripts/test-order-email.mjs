/**
 * Smoke-test SMTP + order confirmation email helpers.
 *
 * Local: loads .env.local if present, then sends a test message.
 *   node scripts/test-order-email.mjs you@example.com
 *
 * Hostinger production: set EMAIL_* in hPanel env vars, redeploy, then SSH and run:
 *   node scripts/test-order-email.mjs your-test@gmail.com
 * (process.env from hPanel is used — .env.local is optional)
 */
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

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
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
];
const missing = required.filter((k) => !String(process.env[k] ?? "").trim());
if (missing.length) {
  console.error("SMTP not configured. Missing:", missing.join(", "));
  process.exit(1);
}

const to = process.argv[2] || process.env.EMAIL_SERVER_USER;
const subject = "Order placed successfully (SMTP test)";
const html = "<p>Test order confirmation email from scripts/test-order-email.mjs</p>";

console.info("[test-order-email] sending", {
  to,
  subject,
  host: process.env.EMAIL_SERVER_HOST,
  port: process.env.EMAIL_SERVER_PORT,
  from: process.env.EMAIL_FROM,
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

try {
  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text: "Test order confirmation email",
  });
  console.info("[test-order-email] sent", {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  });
} catch (err) {
  console.error("[test-order-email] failed", err);
  process.exit(1);
}
