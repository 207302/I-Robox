import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

config();

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  process.env.DIRECT_URL = url.includes("-pooler.")
    ? url.replace("-pooler.", ".")
    : url;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);

// Migrations are run manually before deploying via:
// npx prisma migrate deploy
// Do NOT run during build — Neon free tier advisory lock times out.

const { Client } = pg;
if (process.env.DATABASE_URL) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log("[build] Neon wake-up ping OK");
    await client.end();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[build] Neon wake-up ping failed (continuing):", message);
  }
} else {
  console.warn("[build] Neon wake-up ping skipped: DATABASE_URL not set");
}

run("npx", ["next", "build"]);
