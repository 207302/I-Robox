import "server-only";

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
  businessTitle: string;
  businessWholesaleLabel: string;
  businessWholesaleEmail: string;
  businessRetailLabel: string;
  businessRetailEmail: string;
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
  businessTitle: "Business",
  businessWholesaleLabel: "Wholesale enquiries",
  businessWholesaleEmail: "wholesale@example.com",
  businessRetailLabel: "Retail partnerships",
  businessRetailEmail: "partnerships@example.com",
};

function orDefault(row: string | null | undefined, fallback: string) {
  const t = row?.trim();
  return t ? t : fallback;
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
    businessTitle: orDefault(row.footer_business_title, DEFAULTS.businessTitle),
    businessWholesaleLabel: orDefault(
      row.footer_business_wholesale_label,
      DEFAULTS.businessWholesaleLabel
    ),
    businessWholesaleEmail: orDefault(
      row.footer_business_wholesale_email,
      DEFAULTS.businessWholesaleEmail
    ),
    businessRetailLabel: orDefault(row.footer_business_retail_label, DEFAULTS.businessRetailLabel),
    businessRetailEmail: orDefault(row.footer_business_retail_email, DEFAULTS.businessRetailEmail),
  };
});
