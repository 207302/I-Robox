import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

config();

function normalizePooledUrl(raw) {
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    u.searchParams.set("connect_timeout", "30");
    u.searchParams.set("connection_limit", process.env.BUILD_DATABASE_CONNECTION_LIMIT?.trim() || "2");
    u.searchParams.set("pool_timeout", "60");
    if (u.hostname.includes("-pooler.")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function deriveDirectUrl(pooledUrl) {
  const direct = pooledUrl.includes("-pooler.")
    ? pooledUrl.replace("-pooler.", ".")
    : pooledUrl;
  try {
    const u = new URL(direct);
    u.searchParams.delete("pgbouncer");
    u.searchParams.set("connection_limit", "1");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    u.searchParams.set("connect_timeout", "30");
    return u.toString();
  } catch {
    return direct;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizePooledUrl(process.env.DATABASE_URL);
}
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = deriveDirectUrl(process.env.DATABASE_URL);
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

// Apply pending migrations before static generation (build queries the live schema).
if (process.env.DIRECT_URL || process.env.DATABASE_URL) {
  console.log("[build] Applying pending Prisma migrations…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.warn("[build] Skipping prisma migrate deploy: DATABASE_URL not set");
}

const pingUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (pingUrl) {
  const client = new pg.Client({ connectionString: pingUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log("[build] Neon wake-up ping OK (direct URL)");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[build] Neon wake-up ping failed (continuing):", message);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
} else {
  console.warn("[build] Neon wake-up ping skipped: DATABASE_URL not set");
}

if (!process.env.NODE_ENV || !/^(production|development|test)$/.test(process.env.NODE_ENV)) {
  process.env.NODE_ENV = "production";
}

run("npx", ["next", "build"]);

const siteBase =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  process.env.SITE_URL?.replace(/\/$/, "") ||
  process.env.NEXTAUTH_URL?.replace(/\/$/, "");
if (siteBase) {
  try {
    const res = await fetch(`${siteBase}/api/products`, {
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`[build] shop listing pre-warm: HTTP ${res.status}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[build] shop listing pre-warm skipped:", message);
  }
}

// Hostinger (and some CI runners) treat a hung Node process after a green
// `next build` as a failed deploy — pg/fetch keep-alives can leave the event
// loop open even when the last log line looks successful.
console.log("[build] complete");
process.exit(0);
