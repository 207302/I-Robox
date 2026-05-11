import type { Metadata } from "next";
import QuickLinkContentPage from "@/components/Common/QuickLinkContentPage";
import ContactWhatsAppForm from "@/components/Common/ContactWhatsAppForm";
import { getQuickLinkPageContent } from "@/lib/marketing/quickLinkPages";
import { getStoreContactDisplay } from "@/lib/marketing/storeContactDisplay";

export const metadata: Metadata = {
  title: "Contact Us | i-Robox",
  description: "Get in touch with i-Robox for orders, products, and support.",
};

export default async function ContactPage() {
  const [page, storeContact] = await Promise.all([
    getQuickLinkPageContent("contact"),
    getStoreContactDisplay(),
  ]);
  return (
    <QuickLinkContentPage title={page.title} subtitle={page.subtitle} content={page.content}>
      <ContactWhatsAppForm phone={storeContact.contactPhone} />
    </QuickLinkContentPage>
  );
}
