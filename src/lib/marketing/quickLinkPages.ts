import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";

export type QuickLinkPageKey = "about" | "privacy" | "terms" | "returns" | "faq" | "contact";

export type QuickLinkPageContent = {
  title: string;
  subtitle: string;
  content: string;
};

const DEFAULT_PAGES: Record<QuickLinkPageKey, QuickLinkPageContent> = {
  about: {
    title: "About Us",
    subtitle: "India's destination for RC toys, diecast models, and collectibles.",
    content:
      "i-Robox is an online store focused on RC vehicles, diecast models, and collector-grade toys for enthusiasts across India.\n\nWe source quality products, ship nationwide, and stand behind every order with responsive customer support.\n\nWhether you are building a shelf display or chasing your next track-day RC build, we are here to help you find the right pick.",
  },
  privacy: {
    title: "Privacy Policy",
    subtitle: "How i-Robox collects, uses, and protects your personal information.",
    content:
      "We collect only the information needed to process orders, provide support, and improve the store experience.\n\nThis may include contact details (name, email, phone, address), order history, and basic technical data such as browser and device information.\n\nPayment details are handled by authorized payment providers. i-Robox does not store full card or UPI credentials on our servers.\n\nIf you want your data corrected or removed where legally applicable, contact us using the support channels listed on this site.",
  },
  terms: {
    title: "Terms & Conditions",
    subtitle: "Terms of use for shopping at i-Robox.",
    content:
      "By using this website and placing orders, you agree to these Terms & Conditions.\n\nProduct availability, pricing, and offers can change before checkout is completed.\n\nOrders may be accepted or declined due to stock, payment validation, or fraud checks.\n\nAll content, brand assets, and product media are protected and may not be reused without permission.\n\nFor policy updates, the latest version published on this page applies.",
  },
  returns: {
    title: "Return & Cancellation",
    subtitle: "Cancellation, returns, and refund policy for i-Robox orders.",
    content:
      "Cancellation requests are accepted before shipment handover where possible.\n\nReturns are generally supported for wrong item, transit damage, or verified defects under policy conditions.\n\nFor damage or missing-item claims, please keep clear unboxing evidence to speed up support.\n\nApproved refunds are processed to the original payment method where possible and may take additional bank processing time.",
  },
  faq: {
    title: "FAQ",
    subtitle: "Quick answers to common questions.",
    content:
      "Q: What is the free shipping threshold?\nA: Free shipping applies above the configured cart threshold; below that, shipping is computed from per-product charges or fallback rules.\n\nQ: How do I track my order?\nA: Tracking details are shared once shipment is created.\n\nQ: Can I request a return?\nA: Yes, if your order is eligible under the return policy.",
  },
  contact: {
    title: "Contact us",
    subtitle: "We are happy to help with product questions, order support, and collector enquiries.",
    content: "",
  },
};

function valueOrDefault(value: string | null | undefined, fallback: string) {
  const t = value?.trim();
  return t ? t : fallback;
}

const getQuickLinkPagesInternal = cache(async function getQuickLinkPagesInternal() {
  const row = await prisma.site_marketing_settings
    .findUnique({
      where: { id: SITE_MARKETING_SETTINGS_ID },
      select: {
        about_page_title: true,
        about_page_subtitle: true,
        about_page_content: true,
        privacy_page_title: true,
        privacy_page_subtitle: true,
        privacy_page_content: true,
        terms_page_title: true,
        terms_page_subtitle: true,
        terms_page_content: true,
        returns_page_title: true,
        returns_page_subtitle: true,
        returns_page_content: true,
        faq_page_title: true,
        faq_page_subtitle: true,
        faq_page_content: true,
        contact_page_title: true,
        contact_page_subtitle: true,
        contact_page_content: true,
      },
    })
    .catch(() => null);

  if (!row) return DEFAULT_PAGES;

  return {
    about: {
      title: valueOrDefault(row.about_page_title, DEFAULT_PAGES.about.title),
      subtitle: valueOrDefault(row.about_page_subtitle, DEFAULT_PAGES.about.subtitle),
      content: valueOrDefault(row.about_page_content, DEFAULT_PAGES.about.content),
    },
    privacy: {
      title: valueOrDefault(row.privacy_page_title, DEFAULT_PAGES.privacy.title),
      subtitle: valueOrDefault(row.privacy_page_subtitle, DEFAULT_PAGES.privacy.subtitle),
      content: valueOrDefault(row.privacy_page_content, DEFAULT_PAGES.privacy.content),
    },
    terms: {
      title: valueOrDefault(row.terms_page_title, DEFAULT_PAGES.terms.title),
      subtitle: valueOrDefault(row.terms_page_subtitle, DEFAULT_PAGES.terms.subtitle),
      content: valueOrDefault(row.terms_page_content, DEFAULT_PAGES.terms.content),
    },
    returns: {
      title: valueOrDefault(row.returns_page_title, DEFAULT_PAGES.returns.title),
      subtitle: valueOrDefault(row.returns_page_subtitle, DEFAULT_PAGES.returns.subtitle),
      content: valueOrDefault(row.returns_page_content, DEFAULT_PAGES.returns.content),
    },
    faq: {
      title: valueOrDefault(row.faq_page_title, DEFAULT_PAGES.faq.title),
      subtitle: valueOrDefault(row.faq_page_subtitle, DEFAULT_PAGES.faq.subtitle),
      content: valueOrDefault(row.faq_page_content, DEFAULT_PAGES.faq.content),
    },
    contact: {
      title: valueOrDefault(row.contact_page_title, DEFAULT_PAGES.contact.title),
      subtitle: valueOrDefault(row.contact_page_subtitle, DEFAULT_PAGES.contact.subtitle),
      content: valueOrDefault(row.contact_page_content, DEFAULT_PAGES.contact.content),
    },
  } as Record<QuickLinkPageKey, QuickLinkPageContent>;
});

export async function getQuickLinkPageContent(key: QuickLinkPageKey): Promise<QuickLinkPageContent> {
  const pages = await getQuickLinkPagesInternal();
  return pages[key];
}

