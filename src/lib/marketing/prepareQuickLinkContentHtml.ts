import { sanitizeQuickLinkHtml } from "@/lib/sanitizeQuickLinkHtml";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True if string looks like HTML from TinyMCE or a prior migration. */
function looksLikeHtmlFragment(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s.trim());
}

/**
 * Normalize quick-link page body for public render: sanitize HTML, or wrap legacy plain text as paragraphs.
 */
export function prepareQuickLinkContentForHtml(raw: string): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";

  if (looksLikeHtmlFragment(t)) {
    return sanitizeQuickLinkHtml(t);
  }

  const blocks = t.split(/\n\n+/);
  const inner = blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return sanitizeQuickLinkHtml(inner);
}
