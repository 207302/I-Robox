/**
 * Cloudinary delivery transforms for homepage/catalog images.
 * Next/image still optimizes further; this caps source dimensions at the CDN.
 */
import {
  HERO_BANNER_HEIGHT,
  HERO_BANNER_WIDTH,
  HERO_MOBILE_DELIVERY_WIDTH,
  heroBannerHeightForWidth,
} from "@/lib/images/heroDimensions";
export function isCloudinaryDeliveryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com") && url.includes("/image/upload/");
}

export type CloudinaryQuality = "auto" | "auto:good" | "auto:best" | "auto:eco" | number;

function qualityTransform(quality: CloudinaryQuality): string {
  if (typeof quality === "number") {
    return `q_${Math.min(100, Math.max(1, Math.round(quality)))}`;
  }
  return `q_${quality}`;
}

export function cloudinaryDeliverUrl(
  url: string,
  opts?: {
    width?: number;
    height?: number;
    dpr?: number;
    quality?: CloudinaryQuality;
    crop?: "limit" | "fill";
    gravity?: "auto" | "north" | "center";
  }
): string {
  const trimmed = url?.trim();
  if (!trimmed) return trimmed;
  if (!isCloudinaryDeliveryUrl(trimmed)) {
    return trimmed;
  }

  const w = opts?.width;
  const dpr = opts?.dpr;
  const q = opts?.quality ?? "auto";
  const transforms = [
    opts?.crop === "limit" ? "c_limit" : opts?.crop === "fill" ? "c_fill" : null,
    opts?.gravity === "auto"
      ? "g_auto"
      : opts?.gravity === "north"
        ? "g_north"
        : opts?.gravity === "center"
          ? "g_center"
          : null,
    "f_auto",
    qualityTransform(q),
    w ? `w_${w}` : null,
    opts?.height ? `h_${opts.height}` : null,
    dpr != null && dpr > 0 ? `dpr_${dpr}` : null,
  ]
    .filter(Boolean)
    .join(",");

  return trimmed.replace("/image/upload/", `/image/upload/${transforms}/`);
}

/** Hero banner — sharp desktop delivery (fallback when srcSet unsupported). */
export function cloudinaryHeroUrl(url: string): string {
  return cloudinaryHeroDeliverUrl(url, 1280);
}

/** High-quality hero transform — fixed crop with auto gravity per width. */
function cloudinaryHeroDeliverUrl(url: string, layoutWidth: number): string {
  const layoutHeight = heroBannerHeightForWidth(layoutWidth);
  return cloudinaryDeliverUrl(url, {
    width: layoutWidth,
    height: layoutHeight,
    dpr: 2,
    quality: "auto:best",
    crop: "fill",
    gravity: "center",
  });
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

/**
 * Layout widths for hero srcSet — physical pixels via dpr_2.0 (not extra q/f changes).
 * w_1440 is the delivery ceiling; browser picks smaller descriptors via sizes + srcSet.
 */
const HERO_SRCSET_LAYOUT_WIDTHS = [390, 640, 828, 1080, 1280, 1440] as const;

/** Desktop hero delivery ceiling — matches 1440×580 banner assets. */
export const HERO_WIDTH_CEILING = HERO_BANNER_WIDTH;
export const HERO_HEIGHT_CEILING = HERO_BANNER_HEIGHT;
/** Mobile hero delivery — same aspect ratio as desktop banners. */
export const HERO_MOBILE_WIDTH = HERO_MOBILE_DELIVERY_WIDTH;
export const HERO_MOBILE_HEIGHT = heroBannerHeightForWidth(HERO_MOBILE_DELIVERY_WIDTH);

/**
 * Single hero source URL for next/image — width ceiling only (no dpr).
 * Next.js generates responsive /_next/image srcset from sizes + deviceSizes.
 */
export function cloudinaryHeroSourceUrl(url: string): string {
  return cloudinaryHeroSlideUrl(url, true);
}

/** Hero slide source: fixed crop to 1440×580 frame, center-weighted. */
export function cloudinaryHeroSlideUrl(url: string, isLcp: boolean): string {
  return cloudinaryDeliverUrl(cloudinaryUrlWithoutTransforms(url), {
    width: HERO_WIDTH_CEILING,
    height: HERO_HEIGHT_CEILING,
    quality: isLcp ? "auto:best" : "auto:good",
    crop: "fill",
    gravity: "center",
  });
}

/** Mobile hero source: same aspect ratio as desktop banners. */
export function cloudinaryHeroMobileUrl(src: string, isLcp: boolean = false): string {
  return cloudinaryDeliverUrl(cloudinaryUrlWithoutTransforms(src), {
    width: HERO_MOBILE_WIDTH,
    height: HERO_MOBILE_HEIGHT,
    quality: isLcp ? "auto:best" : "auto:good",
    crop: "fill",
    gravity: "center",
  });
}

/** Hero delivery URL for a layout width (dpr_2.0, q_auto:best unchanged). */
export function cloudinaryHeroDeliverUrlForLayout(url: string, layoutWidth: number): string {
  return cloudinaryHeroDeliverUrl(cloudinaryUrlWithoutTransforms(url), layoutWidth);
}

/** Responsive hero srcSet for direct Cloudinary delivery (mobile LCP sizing). */
export function cloudinaryHeroSrcSet(url: string): { src: string; srcSet: string } {
  const base = cloudinaryUrlWithoutTransforms(url);
  const srcSet = HERO_SRCSET_LAYOUT_WIDTHS.map(
    (w) => `${cloudinaryHeroDeliverUrl(base, w)} ${w}w`
  ).join(", ");
  return {
    src: cloudinaryHeroDeliverUrl(base, 640),
    srcSet,
  };
}

/** Highlight / category / brand tiles. */
export function cloudinaryCardUrl(url: string, width = 640): string {
  return cloudinaryDeliverUrl(url, { width, quality: "auto" });
}

/** Product grid cards — layout ~180–380px; width cap saves bytes (quality unchanged). */
export function cloudinaryProductCardUrl(url: string, width = 220): string {
  return cloudinaryDeliverUrl(url, { width, quality: "auto" });
}

/** Shop grid srcSet — 280w desktop column, 380w mobile (matches PRODUCT_CARD_GRID_SIZES). */
export function cloudinaryProductCardSrcSet(url: string): { src: string; srcSet: string } {
  const base = cloudinaryUrlWithoutTransforms(url);
  const w280 = cloudinaryProductCardUrl(base, 280);
  const w380 = cloudinaryProductCardUrl(base, 380);
  return {
    src: w380,
    srcSet: `${w280} 280w, ${w380} 380w`,
  };
}
