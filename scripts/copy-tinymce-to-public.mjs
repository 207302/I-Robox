import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "tinymce");
const dest = path.join(root, "public", "tinymce");

if (!fs.existsSync(src)) {
  console.warn("[copy-tinymce] node_modules/tinymce missing; skip (run npm install).");
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("[copy-tinymce] copied to public/tinymce");
