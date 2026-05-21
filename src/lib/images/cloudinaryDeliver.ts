/**
 * Cloudinary delivery transforms for homepage/catalog images.
 * Next/image still optimizes further; this caps source dimensions at the CDN.
 */
export function cloudinaryDeliverUrl(
  url: string,
  opts?: { width?: number; quality?: "auto" | number }
): string {
  const trimmed = url?.trim();
  if (!trimmed) return trimmed;
  if (!trimmed.includes("res.cloudinary.com") || !trimmed.includes("/image/upload/")) {
    return trimmed;
  }

  const w = opts?.width;
  const q = opts?.quality ?? "auto";
  const qPart = q === "auto" ? "q_auto" : `q_${q}`;
  const transforms = ["f_auto", qPart, w ? `w_${w}` : null].filter(Boolean).join(",");

  return trimmed.replace("/image/upload/", `/image/upload/${transforms}/`);
}

/** Hero banner — full viewport width, capped for LCP. */
export function cloudinaryHeroUrl(url: string): string {
  return cloudinaryDeliverUrl(url, { width: 1920, quality: 80 });
}

/** Highlight / category / brand tiles. */
export function cloudinaryCardUrl(url: string, width = 640): string {
  return cloudinaryDeliverUrl(url, { width, quality: "auto" });
}

/** Product grid cards on homepage. */
export function cloudinaryProductCardUrl(url: string): string {
  return cloudinaryDeliverUrl(url, { width: 512, quality: "auto" });
}
