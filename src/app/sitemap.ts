import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SEO_SITE_URL } from "@/lib/seo/constants";

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

  try {
    const [products, categories] = await Promise.all([
      prisma.products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true },
        orderBy: { updated_at: "desc" },
      }),
      prisma.categories.findMany({
        select: { slug: true, updated_at: true },
        orderBy: { name: "asc" },
      }),
    ]);

    productEntries = products.map((p) => ({
      url: `${BASE}/shop/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    categoryEntries = categories.map((c) => ({
      url: `${BASE}/shop?category=${encodeURIComponent(c.slug)}`,
      lastModified: c.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // e.g. missing DATABASE_URL at build — still serve static URLs
  }

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
