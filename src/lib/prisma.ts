import "server-only";

import { PrismaClient } from "@prisma/client";
import { ensureDatabaseEnvLoaded, getDatabaseUrlFromEnv } from "@/lib/loadDatabaseEnv";
import { extendPrismaForPerf } from "@/lib/observability/prisma";

const BUILD_PHASE = "phase-production-build";

export function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === BUILD_PHASE;
}

/** Runtime: 1 conn/process on Hostinger prod. Dev uses a higher limit for parallel SSR/API. */
function connectionLimitForRuntime(): string {
  if (process.env.NODE_ENV !== "production") return "10";
  const fromEnv = process.env.DATABASE_CONNECTION_LIMIT?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) return fromEnv;
  if (isProductionBuildPhase()) return "10";
  return "1";
}

function normalizeDatabaseUrl(raw: string, opts?: { pooled?: boolean }) {
  const building = isProductionBuildPhase();
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    u.searchParams.set("connect_timeout", building ? "30" : "10");
    u.searchParams.set("connection_limit", connectionLimitForRuntime());
    u.searchParams.set("pool_timeout", building ? "60" : "20");
    if (opts?.pooled && u.hostname.includes("-pooler.") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** Resolved pooler URL for Prisma `datasource`. */
export function resolveDatabaseConnectionString(): string {
  ensureDatabaseEnvLoaded();
  const raw = getDatabaseUrlFromEnv();
  if (!raw) {
    throw new Error(
      "DATABASE_URL is missing. Add it to .env.local (pooler host) in the project root."
    );
  }
  const normalized = normalizeDatabaseUrl(raw, { pooled: true });
  process.env.DATABASE_URL = normalized;

  if (!process.env.DIRECT_URL?.trim()) {
    const direct = normalized.includes("-pooler.")
      ? normalized.replace("-pooler.", ".")
      : normalized;
    process.env.DIRECT_URL = normalizeDatabaseUrl(direct, { pooled: false });
  }

  return normalized;
}

type PrismaGlobal = {
  prisma?: PrismaClient;
  prismaReadyPromise?: Promise<void>;
  prismaBootUrl?: string;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

let initMutexTail: Promise<void> = Promise.resolve();

function withInitMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = initMutexTail.then(fn, fn);
  initMutexTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function prismaLogLevel(): ("error" | "warn")[] | ("error")[] {
  return process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
}

function resetPrismaGlobals(): void {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaReadyPromise = undefined;
  globalForPrisma.prismaBootUrl = undefined;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = resolveDatabaseConnectionString();
  const log = prismaLogLevel();

  return extendPrismaForPerf(
    new PrismaClient({
      log,
      datasources: { db: { url: databaseUrl } },
    })
  );
}

export function getPrisma(): PrismaClient {
  const databaseUrl = resolveDatabaseConnectionString();

  if (globalForPrisma.prisma && globalForPrisma.prismaBootUrl !== databaseUrl) {
    resetPrismaGlobals();
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prismaBootUrl = databaseUrl;
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export async function reinitializePrismaClient(): Promise<PrismaClient> {
  return withInitMutex(async () => {
    const previous = globalForPrisma.prisma;
    resetPrismaGlobals();

    if (previous) {
      try {
        await previous.$disconnect();
      } catch {
        /* engine may already be dead */
      }
    }

    const next = createPrismaClient();
    globalForPrisma.prismaBootUrl = process.env.DATABASE_URL?.trim();
    globalForPrisma.prisma = next;
    await next.$connect();
    return next;
  });
}

export function prismaReady(): Promise<void> {
  if (globalForPrisma.prismaReadyPromise) {
    return globalForPrisma.prismaReadyPromise;
  }

  globalForPrisma.prismaReadyPromise = withInitMutex(async () => {
    await getPrisma().$connect();
  }).catch((err) => {
    globalForPrisma.prismaReadyPromise = undefined;
    throw err;
  });

  return globalForPrisma.prismaReadyPromise;
}

export default prisma;
