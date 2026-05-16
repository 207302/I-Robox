import { PrismaClient } from "@prisma/client";

/** Neon pooler URLs break interactive `$transaction`; derive direct URL when omitted. */
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  process.env.DIRECT_URL = url.includes("-pooler.")
    ? url.replace("-pooler.", ".")
    : url;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
