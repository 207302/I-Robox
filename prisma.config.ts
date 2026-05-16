import 'dotenv/config'
import { defineConfig } from 'prisma/config';

// IMPORTANT: Do not hardcode database credentials in the repo.
// The datasource URL must come from the environment (e.g. local `.env` / Vercel env var).
const databaseUrl = process.env.DATABASE_URL;
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