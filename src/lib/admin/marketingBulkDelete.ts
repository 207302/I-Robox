import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { revalidateHomePage, revalidateMarketingSite } from "@/lib/cache/homePageCache";
import {
  revalidateAnnouncements,
  revalidateFlashSales,
  revalidatePopups,
} from "@/lib/cache/revalidate";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type MarketingBulkEntity =
  | "hero-slides"
  | "highlights"
  | "brand-rail"
  | "category-tiles"
  | "announcements"
  | "popups"
  | "flash-sales";

export type MarketingBulkDeleteResult =
  | { ok: true; id: string }
  | { ok: false; id: string; error: string };

function cloudinaryPublicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = "/image/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = u.pathname.slice(idx + marker.length);
    tail = tail.replace(/^([^/]+\/)*v\d+\//, "");
    if (!tail) return null;
    return tail.replace(/\.[^./]+$/, "");
  } catch {
    return null;
  }
}

function cloudinaryPublicIdFromStoredOrUrl(
  publicId: string | null | undefined,
  url: string | null | undefined
): string | null {
  if (publicId?.trim()) return publicId.trim();
  return cloudinaryPublicIdFromUrl(url);
}

async function destroyCloudinaryIfPrefix(publicId: string | null, prefix: string) {
  if (publicId?.startsWith(prefix)) {
    await cloudinary.uploader.destroy(publicId).catch(() => null);
  }
}

export async function deleteMarketingEntityById(
  entity: MarketingBulkEntity,
  id: string
): Promise<MarketingBulkDeleteResult> {
  try {
    switch (entity) {
      case "hero-slides": {
        const row = await prisma.homepage_hero_slides.findUnique({
          where: { id },
          select: { image_url: true },
        });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.homepage_hero_slides.delete({ where: { id } });
        await destroyCloudinaryIfPrefix(
          cloudinaryPublicIdFromUrl(row.image_url),
          "irobox/homepage-hero/"
        );
        return { ok: true, id };
      }
      case "highlights": {
        const row = await prisma.homepage_highlights.findUnique({
          where: { id },
          select: { image_url: true },
        });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.homepage_highlights.delete({ where: { id } });
        await destroyCloudinaryIfPrefix(
          cloudinaryPublicIdFromUrl(row.image_url),
          "irobox/homepage-highlights/"
        );
        return { ok: true, id };
      }
      case "brand-rail": {
        const row = await prisma.homepage_brand_rail.findUnique({
          where: { id },
          select: { image_url: true, image_public_id: true },
        });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.homepage_brand_rail.delete({ where: { id } });
        await destroyCloudinaryIfPrefix(
          cloudinaryPublicIdFromStoredOrUrl(row.image_public_id, row.image_url),
          "irobox/homepage-brand-rail/"
        );
        return { ok: true, id };
      }
      case "category-tiles": {
        const row = await prisma.homepage_category_tiles.findUnique({
          where: { id },
          select: { image_url: true, image_public_id: true },
        });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.homepage_category_tiles.delete({ where: { id } });
        await destroyCloudinaryIfPrefix(
          cloudinaryPublicIdFromStoredOrUrl(row.image_public_id, row.image_url),
          "irobox/homepage-category-tiles/"
        );
        return { ok: true, id };
      }
      case "announcements": {
        const row = await prisma.announcement_entries.findUnique({ where: { id }, select: { id: true } });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.announcement_entries.delete({ where: { id } });
        return { ok: true, id };
      }
      case "popups": {
        const row = await prisma.marketing_popups.findUnique({
          where: { id },
          select: { image_url: true },
        });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.marketing_popups.delete({ where: { id } });
        await destroyCloudinaryIfPrefix(
          cloudinaryPublicIdFromUrl(row.image_url),
          "irobox/marketing-popups/"
        );
        return { ok: true, id };
      }
      case "flash-sales": {
        const row = await prisma.flash_sales.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!row) return { ok: false, id, error: "Not found" };
        await prisma.flash_sales.delete({ where: { id } });
        return { ok: true, id };
      }
      default:
        return { ok: false, id, error: "Unknown entity" };
    }
  } catch (err: unknown) {
    return { ok: false, id, error: err instanceof Error ? err.message : "Delete failed" };
  }
}

export function revalidateAfterMarketingBulkDelete(entity: MarketingBulkEntity) {
  switch (entity) {
    case "hero-slides":
      revalidateHomePage();
      revalidateMarketingSite();
      break;
    case "highlights":
    case "brand-rail":
    case "category-tiles":
      revalidateHomePage();
      break;
    case "announcements":
      revalidateAnnouncements();
      break;
    case "popups":
      revalidatePopups();
      break;
    case "flash-sales":
      void revalidateFlashSales();
      break;
  }
}

export const MARKETING_BULK_ENTITIES: MarketingBulkEntity[] = [
  "hero-slides",
  "highlights",
  "brand-rail",
  "category-tiles",
  "announcements",
  "popups",
  "flash-sales",
];
