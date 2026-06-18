import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE, SEO_SITE_NAME, SEO_SITE_URL } from "@/lib/seo/constants";

export function truncateMetaDescription(text: string, max = 155): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function productImageAlt(productName: string): string {
  const name = productName.trim() || "Product";
  return `${name} - Buy Online | i-robox`;
}

export function absoluteSeoUrl(path: string): string {
  if (!path) return SEO_SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? `${SEO_SITE_URL}${path}` : `${SEO_SITE_URL}/${path}`;
}

type SocialMetadataInput = {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
};

export function buildSocialMetadata(
  input: SocialMetadataInput
): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  const url = absoluteSeoUrl(input.path ?? "/");
  const image = input.image ? absoluteSeoUrl(input.image) : DEFAULT_OG_IMAGE;
  return {
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url,
      siteName: SEO_SITE_NAME,
      title: input.title,
      description: input.description,
      images: [{ url: image, alt: input.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}
