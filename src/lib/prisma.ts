import { PrismaClient } from "@prisma/client";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

const BUILD_PHASE = "phase-production-build";

export function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === BUILD_PHASE;
}

/** Runtime: 1 conn/process on shared hosting. Build: larger pool for parallel SSG workers. */
function connectionLimitForRuntime(): string {
  const fromEnv = process.env.DATABASE_CONNECTION_LIMIT?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) return fromEnv;
  if (isProductionBuildPhase()) return "10";
  return process.env.NODE_ENV === "production" ? "1" : "5";
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

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL, { pooled: true });
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const direct = url.includes("-pooler.") ? url.replace("-pooler.", ".") : url;
  process.env.DIRECT_URL = normalizeDatabaseUrl(direct, { pooled: false });
}

type PrismaGlobal = {
  prisma?: PrismaClient;
  prismaReadyPromise?: Promise<void>;
  neonPool?: Pool;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

/** Serializes engine init / reconnect so concurrent callers share one connect. */
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

function createPrismaClient(): PrismaClient {
  const log = prismaLogLevel();

  if (isProductionBuildPhase()) {
    return new PrismaClient({ log });
  }

  neonConfig.webSocketConstructor = ws;
  globalForPrisma.neonPool?.end().catch(() => undefined);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  globalForPrisma.neonPool = pool;
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter, log });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
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

/** Disconnect and create a fresh client (used after engine panic). */
export async function reinitializePrismaClient(): Promise<PrismaClient> {
  return withInitMutex(async () => {
    const previous = globalForPrisma.prisma;
    globalForPrisma.prismaReadyPromise = undefined;
    globalForPrisma.prisma = undefined;

    if (previous) {
      try {
        await previous.$disconnect();
      } catch {
        /* engine may already be dead */
      }
    }

    if (globalForPrisma.neonPool) {
      try {
        await globalForPrisma.neonPool.end();
      } catch {
        /* ignore */
      }
      globalForPrisma.neonPool = undefined;
    }

    const next = createPrismaClient();
    globalForPrisma.prisma = next;
    await next.$connect();
    return next;
  });
}

/** One engine boot per process — mutex-serialized for concurrent startup callers. */
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
