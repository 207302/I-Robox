import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SEO_SITE_URL } from "@/lib/seo/constants";
import { collectProductSitemapImages } from "@/lib/seo/sitemapProductImages";

/** Regenerate periodically so new products appear without redeploying. */
export const revalidate = 3600;

const BASE = SEO_SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE}/about-us`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE}/terms-conditions`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE}/returns`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE}/return-cancellation`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  let productEntries: MetadataRoute.Sitemap = [];
  let categoryEntries: MetadataRoute.Sitemap = [];
  let brandEntries: MetadataRoute.Sitemap = [];

  try {
    const [products, categories, brands] = await Promise.all([
      prisma.products.findMany({
        where: { is_active: true },
        select: {
          slug: true,
          name: true,
          updated_at: true,
          product_images: {
            select: { url: true, sort_order: true, alt_text: true },
            orderBy: { sort_order: "asc" },
          },
          product_variants: {
            select: {
              product_images: {
                select: { url: true, sort_order: true, alt_text: true },
                orderBy: { sort_order: "asc" },
              },
            },
          },
        },
        orderBy: { updated_at: "desc" },
      }),
      prisma.categories.findMany({
        select: { slug: true, updated_at: true },
        orderBy: { name: "asc" },
      }),
      // Only brands with live products — an all-brands list feeds Google
      // empty pages it then reports as soft 404s.
      prisma.brands.findMany({
        where: { products: { some: { is_active: true } } },
        select: { slug: true, updated_at: true },
        orderBy: { name: "asc" },
      }),
    ]);

    productEntries = products.map((p) => {
      const images = collectProductSitemapImages(p);
      return {
        url: `${BASE}/shop/${p.slug}`,
        lastModified: p.updated_at,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        ...(images.length > 0 ? { images } : {}),
      };
    });

    categoryEntries = categories.map((c) => ({
      url: `${BASE}/category/${encodeURIComponent(c.slug)}`,
      lastModified: c.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    brandEntries = brands.map((b) => ({
      url: `${BASE}/brand/${encodeURIComponent(b.slug)}`,
      lastModified: b.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // e.g. missing DATABASE_URL at build — still serve static URLs
  }

  return [...staticEntries, ...categoryEntries, ...brandEntries, ...productEntries];
}
