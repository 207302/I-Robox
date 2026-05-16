import { PrismaClient } from "@prisma/client";

function normalizeNeonUrl(raw: string, opts?: { pooled?: boolean }) {
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "30");
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "30");
    }
    if (opts?.pooled && u.hostname.includes("-pooler.") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeNeonUrl(process.env.DATABASE_URL, { pooled: true });
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const direct = url.includes("-pooler.") ? url.replace("-pooler.", ".") : url;
  process.env.DIRECT_URL = normalizeNeonUrl(direct, { pooled: false });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
