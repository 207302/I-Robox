import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config();

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  process.env.DIRECT_URL = url.includes("-pooler.")
    ? url.replace("-pooler.", ".")
    : url;
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
