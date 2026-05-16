import Footer from "../../components/Footer";
import ScrollToTop from "@/components/Common/ScrollToTop";
import { Toaster } from "react-hot-toast";
import Providers from "./Providers";
import SiteTopLoader from "@/components/Common/SiteTopLoader";
import { Suspense } from "react";
import MainHeader from "@/components/Header/MainHeader";
import Breadcrumb from "@/components/Common/Breadcrumb";
import WhatsAppFloatingDeferred from "@/components/Common/WhatsAppFloatingDeferred";
import { getSiteLayoutShell } from "@/lib/siteLayoutShell";

export const revalidate = 120;

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { utilityAnnouncement, marqueeAnnouncements, headerNav, storeContact, freeShippingThresholdInr } =
    await getSiteLayoutShell();

  return (
    <div>
      <>
        <Providers>
          <SiteTopLoader />
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
            />
          </Suspense>
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
