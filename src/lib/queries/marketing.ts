import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeSiteMarketingSettingsFindUnique } from "@/lib/db/safeReads";
import { EMPTY_CHROME_COLORS, type SiteChromeColors } from "@/lib/marketing/chromeColors";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { FLASH_SALES_TAG, MARKETING_TAG, POPUPS_TAG } from "@/lib/cache/tags";

export const getSiteMarketingSettings = unstable_cache(
  async () => {
    try {
      return await safeSiteMarketingSettingsFindUnique({
        where: { id: SITE_MARKETING_SETTINGS_ID },
      });
    } catch {
      return null;
    }
  },
  ["site-marketing-settings"],
  { revalidate: 3600, tags: [MARKETING_TAG] }
);

export const getMarketingPopups = unstable_cache(
  async () => {
    try {
      return await prisma.marketing_popups.findMany({
        orderBy: { sort_priority: "asc" },
      });
    } catch {
      return [];
    }
  },
  ["marketing-popups"],
  { revalidate: 60, tags: [POPUPS_TAG] }
);

export const getFlashSaleProducts = unstable_cache(
  async () => {
    try {
      return await prisma.flash_sale_products.findMany({
        orderBy: { updated_at: "desc" },
        include: { products: { select: { name: true, slug: true } } },
      });
    } catch {
      return [];
    }
  },
  ["flash-sale-products"],
  { revalidate: 30, tags: [FLASH_SALES_TAG] }
);

export const getCouponsForAdmin = unstable_cache(
  async () => {
    try {
      return await prisma.coupons.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          discount_type: true,
          discount_value: true,
          is_active: true,
        },
      });
    } catch {
      return [];
    }
  },
  ["coupons-admin"],
  { revalidate: 60 }
);

/** Storefront hero/highlights overlay fields only. */
export const getSiteMarketingSettingsForHome = unstable_cache(
  async () => {
    try {
      return await safeSiteMarketingSettingsFindUnique({
        where: { id: SITE_MARKETING_SETTINGS_ID },
        select: {
          highlights_section_eyebrow: true,
          highlights_section_heading: true,
          hero_overlay_eyebrow: true,
          hero_overlay_heading: true,
          hero_overlay_subheading: true,
          hero_overlay_cta_label: true,
          hero_overlay_cta_href: true,
          hero_overlay_eyebrow_color: true,
          hero_overlay_heading_color: true,
          hero_overlay_subheading_color: true,
          hero_overlay_cta_label_color: true,
        },
      });
    } catch {
      return null;
    }
  },
  ["site-marketing-settings-home"],
  { revalidate: 3600, tags: [MARKETING_TAG] }
);

export const getSiteChromeColors = unstable_cache(
  async (): Promise<SiteChromeColors> => {
    try {
      const row = await safeSiteMarketingSettingsFindUnique({
        where: { id: SITE_MARKETING_SETTINGS_ID },
        select: {
          utility_bar_bg_color: true,
          marquee_bar_bg_color: true,
          footer_bg_color: true,
          footer_text_color: true,
          footer_link_color: true,
        },
      });
      if (!row) return EMPTY_CHROME_COLORS;
      return {
        utilityBarBg: row.utility_bar_bg_color,
        marqueeBarBg: row.marquee_bar_bg_color,
        footerBg: row.footer_bg_color,
        footerText: row.footer_text_color,
        footerLink: row.footer_link_color,
      };
    } catch {
      return EMPTY_CHROME_COLORS;
    }
  },
  ["site-chrome-colors"],
  { revalidate: 3600, tags: [MARKETING_TAG] }
);
