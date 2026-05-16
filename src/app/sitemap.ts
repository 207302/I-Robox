import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteBaseUrl } from "@/lib/siteUrl";

/** Regenerate periodically so new products appear without redeploying. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.75,
    },
    {
      url: `${base}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/terms-conditions`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/returns`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/return-cancellation`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.products.findMany({
      where: { is_active: true },
      select: { slug: true, updated_at: true },
      orderBy: { updated_at: "desc" },
    });
    productEntries = products.map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // e.g. missing DATABASE_URL at build — still serve static URLs
  }

  return [...staticEntries, ...productEntries];
}
