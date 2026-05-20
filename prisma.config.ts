import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js uses `.env.local`; Prisma CLI only auto-loads `.env` — load both (local wins).
config({ path: ".env.local" });
config();

// IMPORTANT: Do not hardcode database credentials in the repo.
// The datasource URL must come from the environment (e.g. local `.env` / Vercel env var).
const databaseUrl = process.env.DATABASE_URL;

/** Schema requires DIRECT_URL; derive from DATABASE_URL when omitted (Neon pooler → direct host). */
if (!process.env.DIRECT_URL && databaseUrl) {
  process.env.DIRECT_URL = databaseUrl.includes("-pooler.")
    ? databaseUrl.replace("-pooler.", ".")
    : databaseUrl;
}

/** Non-pooled URL for migrations / interactive transactions (Neon: use the direct connection string). */
const directUrl = process.env.DIRECT_URL ?? databaseUrl;

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations'
    },
    datasource: {
        url: databaseUrl ?? '',
        directUrl: directUrl ?? '',
    },
});