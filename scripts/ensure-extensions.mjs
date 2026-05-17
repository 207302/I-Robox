import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config();

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  process.env.DIRECT_URL = url.includes("-pooler.")
    ? url.replace("-pooler.", ".")
    : url;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

try {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  console.log("[ensure-extensions] pg_trgm extension is enabled.");
} catch (err) {
  console.error("[ensure-extensions] failed:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
