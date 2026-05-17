import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { getHeaderNavData } from "@/lib/nav/headerNav";
import { getStoreContactDisplay } from "@/lib/marketing/storeContactDisplay";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";
import { EMPTY_CHROME_COLORS, type SiteChromeColors } from "@/lib/marketing/chromeColors";
import { getSiteChromeColors } from "@/lib/queries/marketing";
import type { HeaderNavData } from "@/lib/nav/headerNav";
import { ANNOUNCEMENTS_TAG, MARKETING_TAG } from "@/lib/cache/homePageCache";
import { CATEGORIES_TAG, HEADER_NAV_TAG } from "@/lib/cache/tags";

export type SiteLayoutShell = {
  utilityAnnouncement: {
    body: string;
    linkUrl: string | null;
    linkLabel: string | null;
  } | null;
  marqueeAnnouncements: { body: string; linkUrl: string | null }[];
  headerNav: HeaderNavData;
  storeContact: Awaited<ReturnType<typeof getStoreContactDisplay>>;
  freeShippingThresholdInr: Awaited<ReturnType<typeof getFreeShippingThresholdInr>>;
  chromeColors: SiteChromeColors;
};

export const EMPTY_SHELL: SiteLayoutShell = {
  utilityAnnouncement: null,
  marqueeAnnouncements: [],
  headerNav: { categories: [], brands: [] },
  storeContact: {
    helpSupportTitle: "Help & Support",
    contactAddress: "",
    contactPhone: "",
    contactEmail: "",
    socialFacebookUrl: "",
    socialTwitterUrl: "",
    socialInstagramUrl: "",
    socialLinkedInUrl: "",
  },
  freeShippingThresholdInr: 2000,
  chromeColors: EMPTY_CHROME_COLORS,
};

async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[siteLayoutShell] ${label}:`, err);
    return fallback;
  }
}

async function loadSiteLayoutShell(): Promise<SiteLayoutShell> {
  const now = new Date();

  const announcementRows = await safe("announcements", [], () =>
    prisma.announcement_entries.findMany({
      orderBy: [{ placement: "asc" }, { sort_order: "asc" }],
    })
  );

  const activeAnnouncements = announcementRows.filter((e) =>
    isActiveInWindow(e.is_active, e.active_from, e.active_until, now)
  );
  const utilityRows = activeAnnouncements.filter((e) => e.placement === "UTILITY");
  const marqueeRows = activeAnnouncements.filter((e) => e.placement === "MARQUEE");
  const utilityPrimary = utilityRows[0];

  const [headerNav, storeContact, freeShippingThresholdInr, chromeColors] = await Promise.all([
    safe("headerNav", EMPTY_SHELL.headerNav, getHeaderNavData),
    safe("storeContact", EMPTY_SHELL.storeContact, getStoreContactDisplay),
    safe("freeShippingThresholdInr", EMPTY_SHELL.freeShippingThresholdInr, getFreeShippingThresholdInr),
    safe("chromeColors", EMPTY_SHELL.chromeColors, getSiteChromeColors),
  ]);

  return {
    utilityAnnouncement: utilityPrimary
      ? {
          body: utilityPrimary.body,
          linkUrl: utilityPrimary.link_url,
          linkLabel: utilityPrimary.link_label,
        }
      : null,
    marqueeAnnouncements: marqueeRows.map((m) => ({
      body: m.body,
      linkUrl: m.link_url,
    })),
    headerNav,
    storeContact,
    freeShippingThresholdInr,
    chromeColors,
  };
}

export const getSiteLayoutShell = unstable_cache(loadSiteLayoutShell, ["site-layout-shell"], {
  revalidate: 3600,
  tags: [MARKETING_TAG, ANNOUNCEMENTS_TAG, HEADER_NAV_TAG, CATEGORIES_TAG],
});
