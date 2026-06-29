/** Strip HTML to plain text for previews, meta tags, and feature bullets. */
export function htmlToPlainText(html: string): string {
  const t = html?.trim() ?? "";
  if (!t) return "";

  const liMatches = [...t.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length) {
    return liMatches
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .join("\n");
  }

  return t
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Feature bullets from short or full description (plain text or HTML). */
export function productDescriptionFeatureLines(
  shortDescription: string,
  description: string
): string[] {
  const source = shortDescription.trim() || description.trim();
  if (!source) return [];

  const liMatches = [...source.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length) {
    return liMatches
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  return htmlToPlainText(source)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}
