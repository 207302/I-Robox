import fs from "fs";
import path from "path";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");
const IMPORT_LINE = 'import { runApiRoute } from "@/lib/api/runApiRoute";\n';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function wrapFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes("runApiRoute")) return false;

  const re = /export async function (GET|POST|PUT|PATCH|DELETE)(\([^)]*\))\s*\{/g;
  const matches = [...content.matchAll(re)];
  if (matches.length === 0) return false;

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = findMatchingBrace(content, openBrace);
    if (closeBrace < 0) continue;

    const before = content.slice(0, openBrace + 1);
    const body = content.slice(openBrace + 1, closeBrace);
    const after = content.slice(closeBrace);

    const indentedBody = body.replace(/\n/g, "\n  ");
    content = `${before}\n  return runApiRoute(async () => {${indentedBody}\n  });${after}`;
  }

  if (!content.includes('import { runApiRoute }')) {
    const importMatches = [...content.matchAll(/^import .+;$/gm)];
    if (importMatches.length > 0) {
      const last = importMatches[importMatches.length - 1];
      const insertAt = last.index + last[0].length;
      content = content.slice(0, insertAt) + "\n" + IMPORT_LINE.trim() + content.slice(insertAt);
    } else {
      content = IMPORT_LINE + content;
    }
  }

  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

const files = walk(API_ROOT);
let wrapped = 0;
for (const file of files) {
  if (wrapFile(file)) {
    wrapped++;
    console.log("wrapped", path.relative(process.cwd(), file));
  }
}
console.log(`Done. Wrapped ${wrapped} route files.`);
