import type { Metadata } from "next";
import ContactSection from "@/components/Contact/ContactSection";
import { prepareQuickLinkContentForHtml } from "@/lib/marketing/prepareQuickLinkContentHtml";
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

  const cmsHtml = prepareQuickLinkContentForHtml(page.content);
  const showPageHeader = Boolean(page.title?.trim() || page.subtitle?.trim());

  return (
    <section className="overflow-hidden py-10 pb-20 pt-32">
      <div className="w-full px-4 mx-auto max-w-6xl sm:px-8 xl:px-0">
        {showPageHeader ? (
          <header className="mb-8 max-w-3xl">
            {page.title?.trim() ? (
              <h1 className="text-3xl font-bold text-dark sm:text-4xl">{page.title}</h1>
            ) : null}
            {page.subtitle?.trim() ? (
              <p className="mt-3 text-base leading-7 text-meta-3">{page.subtitle}</p>
            ) : null}
          </header>
        ) : null}
        <ContactSection phone={storeContact.contactPhone} cmsHtml={cmsHtml || undefined} />
      </div>
    </section>
  );
}
