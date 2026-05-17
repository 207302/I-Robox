import { PrismaClient } from "@prisma/client";

/** Shared hosting: keep pool tiny (1–3 per Node process). Override via DATABASE_CONNECTION_LIMIT. */
function connectionLimitForRuntime(): string {
  const fromEnv = process.env.DATABASE_CONNECTION_LIMIT?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) return fromEnv;
  return process.env.NODE_ENV === "production" ? "2" : "5";
}

function normalizeDatabaseUrl(raw: string, opts?: { pooled?: boolean }) {
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    u.searchParams.set("connect_timeout", "10");
    u.searchParams.set("connection_limit", connectionLimitForRuntime());
    u.searchParams.set("pool_timeout", "20");
    if (opts?.pooled && u.hostname.includes("-pooler.") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL, { pooled: true });
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const direct = url.includes("-pooler.") ? url.replace("-pooler.", ".") : url;
  process.env.DIRECT_URL = normalizeDatabaseUrl(direct, { pooled: false });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Always reuse one client per Node process (critical on shared hosting with tight process limits).
globalForPrisma.prisma = prisma;

export default prisma;
