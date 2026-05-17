import "server-only";

import { PrismaClient } from "@prisma/client";
import { deriveDirectUrlFromPooled, normalizeDatabaseUrl } from "@/lib/databaseUrl";
import { ensureDatabaseEnvLoaded, getDatabaseUrlFromEnv } from "@/lib/loadDatabaseEnv";
import { extendPrismaForPerf } from "@/lib/observability/prisma";

export { isProductionBuildPhase } from "@/lib/databaseUrl";

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
    process.env.DIRECT_URL = deriveDirectUrlFromPooled(normalized);
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
