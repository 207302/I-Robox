import { cache } from "react";
import { getSiteMarketingSettings } from "@/lib/queries/marketing";

/** Resolved storefront strings used in the footer/home sections. */
export type StoreContactDisplay = {
  helpSupportTitle: string;
  contactAddress: string;
  contactPhone: string;
  contactEmail: string;
  socialFacebookUrl: string;
  socialTwitterUrl: string;
  socialInstagramUrl: string;
  socialLinkedInUrl: string;
};

const DEFAULTS: StoreContactDisplay = {
  helpSupportTitle: "Help & Support",
  contactAddress:
    "24, Basement, 21st Main Rd, Banashankari Stage II, Banashankari, Bengaluru, Karnataka 560070",
  contactPhone: "",
  contactEmail: "support@example.com",
  socialFacebookUrl: "",
  socialTwitterUrl: "",
  socialInstagramUrl: "",
  socialLinkedInUrl: "",
};

function orDefault(row: string | null | undefined, fallback: string) {
  const t = row?.trim();
  return t ? t : fallback;
}

/** `tel:` href from a display phone string (spaces stripped). */
export function phoneToTelHref(phone: string) {
  const compact = phone.replace(/\s+/g, "");
  if (!compact) return "tel:";
  return compact.startsWith("+") ? `tel:${compact}` : `tel:${compact}`;
}

/** `wa.me` href from display phone string (keeps digits only). */
export function phoneToWhatsAppHref(phone: string, message?: string) {
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return "";
  const text = encodeURIComponent(message ?? "Hi! I have a question about an order / product.");
  return `https://wa.me/${digits}?text=${text}`;
}

export const getStoreContactDisplay = cache(async function getStoreContactDisplay(): Promise<StoreContactDisplay> {
  const row = await getSiteMarketingSettings().catch(() => null);

  if (!row) return { ...DEFAULTS };

  return {
    helpSupportTitle: orDefault(row.help_support_title, DEFAULTS.helpSupportTitle),
    contactAddress: orDefault(row.contact_address, DEFAULTS.contactAddress),
    contactPhone: orDefault(row.contact_phone, DEFAULTS.contactPhone),
    contactEmail: orDefault(row.contact_email, DEFAULTS.contactEmail),
    socialFacebookUrl: orDefault(row.social_facebook_url, DEFAULTS.socialFacebookUrl),
    socialTwitterUrl: orDefault(row.social_twitter_url, DEFAULTS.socialTwitterUrl),
    socialInstagramUrl: orDefault(row.social_instagram_url, DEFAULTS.socialInstagramUrl),
    socialLinkedInUrl: orDefault(row.social_linkedin_url, DEFAULTS.socialLinkedInUrl),
  };
});
