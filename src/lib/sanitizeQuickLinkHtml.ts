/** Strip obvious XSS vectors from admin-authored HTML before `dangerouslySetInnerHTML`. */
export function sanitizeQuickLinkHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
