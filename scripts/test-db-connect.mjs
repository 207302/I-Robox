import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

const cs = process.env.DATABASE_URL?.trim();
if (!cs) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: cs } } });
await prisma.$queryRaw`SELECT 1`;
console.log("DB OK", new URL(cs).hostname);
await prisma.$disconnect();
