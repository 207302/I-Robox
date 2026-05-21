/**
 * Database env for Prisma — read `process.env` only.
 *
 * Do not read `.env` files here: Next.js (`next dev`), `scripts/run-prisma-build.mjs`,
 * and Vercel inject variables before the app runs. File I/O here caused Turbopack NFT
 * to trace the whole repository.
 */

function stripEnvQuotes(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/** @deprecated No file loading — kept for call-site compatibility. */
export function ensureDatabaseEnvLoaded(): void {
  /* env is injected by the host */
}

export function resolveEnvRoot(): string {
  return process.cwd();
}

export function getDatabaseUrlFromEnv(): string {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  return url ? stripEnvQuotes(url) : "";
}
