/**
 * Cloudinary delivery transforms for homepage/catalog images.
 * Next/image still optimizes further; this caps source dimensions at the CDN.
 */
export function isCloudinaryDeliveryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com") && url.includes("/image/upload/");
}

export function cloudinaryDeliverUrl(
  url: string,
  opts?: { width?: number; quality?: "auto" | number }
): string {
  const trimmed = url?.trim();
  if (!trimmed) return trimmed;
  if (!isCloudinaryDeliveryUrl(trimmed)) {
    return trimmed;
  }

  const w = opts?.width;
  const q = opts?.quality ?? "auto";
  const qPart = q === "auto" ? "q_auto" : `q_${q}`;
  const transforms = ["f_auto", qPart, w ? `w_${w}` : null].filter(Boolean).join(",");

  return trimmed.replace("/image/upload/", `/image/upload/${transforms}/`);
}

/** Hero banner — default src (~tablet/desktop cap). */
export function cloudinaryHeroUrl(url: string): string {
  return cloudinaryDeliverUrl(url, { width: 1080, quality: 80 });
}

/** Cloudinary transform path segments (e.g. f_auto,q_80,w_640) — not version or asset folders. */
function isCloudinaryTransformSegment(segment: string): boolean {
  if (!segment) return false;
  if (/^v\d+$/i.test(segment)) return false;
  if (segment.includes(",")) return true;
  return /^(f_|q_|w_|h_|c_|g_|e_|b_|dpr_|ar_|fl_)/i.test(segment);
}

/** Strip existing transform segments so width variants do not stack. */
function cloudinaryUrlWithoutTransforms(url: string): string {
  const marker = "/image/upload/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return url;

  const prefix = url.slice(0, markerIndex + marker.length);
  const segments = url.slice(markerIndex + marker.length).split("/");
  while (segments.length > 0 && isCloudinaryTransformSegment(segments[0]!)) {
    segments.shift();
  }
  return segments.length > 0 ? `${prefix}${segments.join("/")}` : url;
}

/** Responsive hero srcSet for direct Cloudinary delivery (mobile LCP sizing). */
export function cloudinaryHeroSrcSet(url: string): { src: string; srcSet: string } {
  const base = cloudinaryUrlWithoutTransforms(url);
  const w640 = cloudinaryDeliverUrl(base, { width: 640, quality: 80 });
  const w828 = cloudinaryDeliverUrl(base, { width: 828, quality: 80 });
  const w1080 = cloudinaryDeliverUrl(base, { width: 1080, quality: 80 });
  const w1920 = cloudinaryDeliverUrl(base, { width: 1920, quality: 80 });
  return {
    src: w828,
    srcSet: `${w640} 640w, ${w828} 828w, ${w1080} 1080w, ${w1920} 1920w`,
  };
}

/** Highlight / category / brand tiles. */
export function cloudinaryCardUrl(url: string, width = 640): string {
  return cloudinaryDeliverUrl(url, { width, quality: "auto" });
}

/** Product grid cards on homepage. */
export function cloudinaryProductCardUrl(url: string): string {
  return cloudinaryDeliverUrl(url, { width: 512, quality: "auto" });
}
