import Footer from "../../components/Footer";
import ScrollOnNavigate from "@/components/Common/ScrollOnNavigate";
import ScrollToTop from "@/components/Common/ScrollToTop";
import Providers from "./Providers";
import SiteTopLoaderDeferred from "@/components/Common/SiteTopLoaderDeferred";
import ToasterDeferred from "@/components/Common/ToasterDeferred";
import BreadcrumbDeferred from "@/components/Common/BreadcrumbDeferred";
import { Suspense } from "react";
import MainHeader from "@/components/Header/MainHeader";
import WhatsAppFloatingDeferred from "@/components/Common/WhatsAppFloatingDeferred";
import { getGuestPublicMarketingPayload } from "@/lib/marketing/publicMarketingPayload";
import { getSiteLayoutShell } from "@/lib/siteLayoutShell";
export const revalidate = 300;

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    {
      utilityAnnouncement,
      marqueeAnnouncements,
      headerNav,
      storeContact,
      freeShippingThresholdInr,
      chromeColors,
    },
    initialMarketing,
  ] = await Promise.all([
    getSiteLayoutShell(),
    getGuestPublicMarketingPayload(),
  ]);

  return (
    <div>
      <>
        <Providers initialMarketing={initialMarketing}>
          <Suspense fallback={null}>
            <ScrollOnNavigate />
          </Suspense>
          <SiteTopLoaderDeferred />
          <Suspense
            fallback={
              <header className="h-[120px] border-b border-gray-3 bg-white" aria-hidden />
            }
          >
            <MainHeader
              headerData={null}
              utilityAnnouncement={utilityAnnouncement}
              marqueeAnnouncements={marqueeAnnouncements}
              headerNav={headerNav}
              freeShippingThresholdInr={freeShippingThresholdInr}
              chromeColors={chromeColors}
            />
          </Suspense>
          <BreadcrumbDeferred />
          <ToasterDeferred position="top-center" reverseOrder={false} />
          {children}
        </Providers>

        <ScrollToTop />
        <WhatsAppFloatingDeferred phone={storeContact.contactPhone} />
        <Footer storeContact={storeContact} chromeColors={chromeColors} />
      </>
    </div>
  );
}
