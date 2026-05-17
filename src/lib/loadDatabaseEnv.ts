import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILES = [".env.local", ".env"] as const;

function envFilePaths(): string[] {
  const cwd = process.cwd();
  return ENV_FILES.map((name) => resolve(cwd, name));
}

function stripEnvQuotes(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Minimal parser — avoids bundler/dotenv edge cases inside Turbopack. */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = stripEnvQuotes(trimmed.slice(eq + 1));
    if (key) process.env[key] = value;
  }
}

/** Load `.env.local` / `.env` before Prisma (instrumentation runs before Next injects env). */
export function ensureDatabaseEnvLoaded(): void {
  if (process.env.DATABASE_URL?.trim()) return;

  for (const path of envFilePaths()) {
    loadEnvFile(path);
    if (process.env.DATABASE_URL?.trim()) break;
  }
}

export function resolveEnvRoot(): string {
  return process.cwd();
}

export function getDatabaseUrlFromEnv(): string {
  ensureDatabaseEnvLoaded();
  const url = process.env.DATABASE_URL?.trim() ?? "";
  return url ? stripEnvQuotes(url) : "";
}
