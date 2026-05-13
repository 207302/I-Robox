/**
 * One-off: convert legacy markdown-ish quick-link page bodies to HTML.
 * - Lines starting with ## → <h2>
 * - Lines starting with * → <ul><li>…
 * Skips rows that already look like HTML (tags present).
 *
 * Usage: npx tsx scripts/convert-quick-link-markdown-to-html.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SITE_MARKETING_SETTINGS_ID } from "../src/lib/marketing/siteSettingsId";

const prisma = new PrismaClient();

const FIELDS = [
  "privacy_page_content",
  "terms_page_content",
  "returns_page_content",
  "faq_page_content",
  "contact_page_content",
] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function looksLikeHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s.trim());
}

function convertMarkdownishToHtml(text: string): string {
  if (!text.trim()) return text;
  if (looksLikeHtml(text)) return text;

  const lines = text.split(/\n/);
  let out = "";
  let inUl = false;

  const closeUl = () => {
    if (inUl) {
      out += "</ul>";
      inUl = false;
    }
  };

  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      closeUl();
      out += `<h2>${escapeHtml(h2[1])}</h2>`;
      continue;
    }
    const bullet = /^\*\s+(.+)$/.exec(line);
    if (bullet) {
      if (!inUl) {
        out += "<ul>";
        inUl = true;
      }
      out += `<li>${escapeHtml(bullet[1])}</li>`;
      continue;
    }
    closeUl();
    if (line.trim() === "") {
      out += "<br/>";
      continue;
    }
    out += `<p>${escapeHtml(line)}</p>`;
  }
  closeUl();
  return out;
}

async function main() {
  const row = await prisma.site_marketing_settings.findUnique({
    where: { id: SITE_MARKETING_SETTINGS_ID },
    select: {
      privacy_page_content: true,
      terms_page_content: true,
      returns_page_content: true,
      faq_page_content: true,
      contact_page_content: true,
    },
  });

  if (!row) {
    console.error("No site_marketing_settings row for id", SITE_MARKETING_SETTINGS_ID);
    process.exit(1);
  }

  const patch: Record<string, string | null> = {};
  let changed = 0;

  for (const field of FIELDS) {
    const before = row[field];
    if (before == null || before === "") continue;
    const after = convertMarkdownishToHtml(before);
    if (after !== before) {
      patch[field] = after;
      changed++;
      console.log(`Updated ${field}`);
    }
  }

  if (changed === 0) {
    console.log("Nothing to convert (empty or already HTML).");
    await prisma.$disconnect();
    return;
  }

  await prisma.site_marketing_settings.update({
    where: { id: SITE_MARKETING_SETTINGS_ID },
    data: patch,
  });
  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
