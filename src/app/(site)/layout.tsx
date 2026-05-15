import Footer from "../../components/Footer";
import ScrollToTop from "@/components/Common/ScrollToTop";
import { Toaster } from "react-hot-toast";
import Providers from "./Providers";
import SiteTopLoader from "@/components/Common/SiteTopLoader";
import MainHeader from "@/components/Header/MainHeader";
import Breadcrumb from "@/components/Common/Breadcrumb";
import WhatsAppFloatingDeferred from "@/components/Common/WhatsAppFloatingDeferred";
import { prisma } from "@/lib/prismaDB";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { getHeaderNavData } from "@/lib/nav/headerNav";
import { getStoreContactDisplay } from "@/lib/marketing/storeContactDisplay";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";

/** Announcement bar / header copy comes from DB; avoid static shell stale on production. */
export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  const utilityAnnouncement = utilityPrimary
    ? {
        body: utilityPrimary.body,
        linkUrl: utilityPrimary.link_url,
        linkLabel: utilityPrimary.link_label,
      }
    : null;
  const marqueeAnnouncements = marqueeRows.map((m) => ({
    body: m.body,
    linkUrl: m.link_url,
  }));

  const headerNav = await getHeaderNavData();
  const [storeContact, freeShippingThresholdInr] = await Promise.all([
    getStoreContactDisplay(),
    getFreeShippingThresholdInr(),
  ]);

  return (
    <div>
      <>
        <Providers>
          <SiteTopLoader />
          <MainHeader
            headerData={null}
            utilityAnnouncement={utilityAnnouncement}
            marqueeAnnouncements={marqueeAnnouncements}
            headerNav={headerNav}
            freeShippingThresholdInr={freeShippingThresholdInr}
          />
          <Breadcrumb />
          <Toaster position="top-center" reverseOrder={false} />
          {children}
        </Providers>

        <ScrollToTop />
        <WhatsAppFloatingDeferred phone={storeContact.contactPhone} />
        <Footer storeContact={storeContact} />
      </>
    </div>
  );
}
