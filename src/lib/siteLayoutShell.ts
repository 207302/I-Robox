import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { getHeaderNavData } from "@/lib/nav/headerNav";
import { getStoreContactDisplay } from "@/lib/marketing/storeContactDisplay";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";
import { EMPTY_CHROME_COLORS, type SiteChromeColors } from "@/lib/marketing/chromeColors";
import { getSiteChromeColors } from "@/lib/queries/marketing";
import { withPrismaRetry } from "@/lib/prismaRetry";
import type { HeaderNavData } from "@/lib/nav/headerNav";

export type SiteLayoutShell = {
  utilityAnnouncement: {
    body: string;
    linkUrl: string | null;
    linkLabel: string | null;
  } | null;
  marqueeAnnouncements: { body: string; linkUrl: string | null }[];
  headerNav: Awaited<ReturnType<typeof getHeaderNavData>>;
  storeContact: Awaited<ReturnType<typeof getStoreContactDisplay>>;
  freeShippingThresholdInr: Awaited<ReturnType<typeof getFreeShippingThresholdInr>>;
  chromeColors: SiteChromeColors;
};

const EMPTY_SHELL: SiteLayoutShell = {
  utilityAnnouncement: null,
  marqueeAnnouncements: [],
  headerNav: { categories: [], brands: [] } as HeaderNavData,
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

async function loadSiteLayoutShell(): Promise<SiteLayoutShell> {
  return withPrismaRetry(async () => {
  const now = new Date();
  const announcementRows = await prisma.announcement_entries.findMany({
    orderBy: [{ placement: "asc" }, { sort_order: "asc" }],
  });
  const activeAnnouncements = announcementRows.filter((e) =>
    isActiveInWindow(e.is_active, e.active_from, e.active_until, now)
  );
  const utilityRows = activeAnnouncements.filter((e) => e.placement === "UTILITY");
  const marqueeRows = activeAnnouncements.filter((e) => e.placement === "MARQUEE");
  const utilityPrimary = utilityRows[0];

  const [headerNav, storeContact, freeShippingThresholdInr, chromeColors] = await Promise.all([
    getHeaderNavData(),
    getStoreContactDisplay(),
    getFreeShippingThresholdInr(),
    getSiteChromeColors(),
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
  }).catch((err) => {
    console.error("[siteLayoutShell] database unavailable:", err);
    return EMPTY_SHELL;
  });
}

export const getSiteLayoutShell = unstable_cache(loadSiteLayoutShell, ["site-layout-shell"], {
  revalidate: 120,
  tags: ["marketing", "announcements", "header-nav"],
});
