import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import {
  getAdminProductPickerList,
  getBrandsForAdmin,
  getCategoriesForAdmin,
} from "@/lib/queries/catalog";
import { getSiteMarketingSettings } from "@/lib/queries/marketing";
import { MarketingAdminDeferredProvider } from "./MarketingAdminContext";
import MarketingAdminClient from "./MarketingAdminClient";
import MarketingDeferredSeeds from "./MarketingDeferredSeeds";

export default async function MarketingAdminPage() {
  const auth = await requireAdminWrite();
  if (!auth.ok) redirect("/admin/login");

  const highlightsPromise = prisma.homepage_highlights
    .findMany({
      orderBy: { sort_order: "asc" },
      include: {
        categories: { select: { id: true, name: true, slug: true } },
        products: { select: { id: true, name: true, slug: true } },
        brands: { select: { id: true, name: true, slug: true } },
      },
    })
    .catch(() =>
      prisma.homepage_highlights.findMany({
        orderBy: { sort_order: "asc" },
        include: {
          categories: { select: { id: true, name: true, slug: true } },
          products: { select: { id: true, name: true, slug: true } },
        },
      })
    );

  // Wave 1 — critical (settings + category pickers)
  const [settings, categories] = await Promise.all([
    getSiteMarketingSettings(),
    getCategoriesForAdmin(),
  ]);

  // Wave 2 — homepage CMS blocks
  const [slides, highlights, brandRail, categoryTiles, announcements] = await Promise.all([
    prisma.homepage_hero_slides.findMany({ orderBy: { sort_order: "asc" } }).catch(() => []),
    highlightsPromise.catch(() => []),
    prisma.homepage_brand_rail
      .findMany({
        orderBy: { sort_order: "asc" },
        include: { brands: { select: { id: true, name: true, slug: true } } },
      })
      .catch(() => []),
    prisma.homepage_category_tiles
      .findMany({
        orderBy: { sort_order: "asc" },
        include: { categories: { select: { id: true, name: true, slug: true } } },
      })
      .catch(() => []),
    prisma.announcement_entries
      .findMany({
        orderBy: [{ placement: "asc" }, { sort_order: "asc" }],
      })
      .catch(() => []),
  ]);

  // Wave 3 — catalog pickers (heavy product list last in this wave)
  const [products, brands] = await Promise.all([
    getAdminProductPickerList(),
    getBrandsForAdmin(),
  ]);

  const productsPlain = products.map((p) => ({
    ...p,
    base_price: Number(p.base_price),
    discounted_price: p.discounted_price != null ? Number(p.discounted_price) : null,
  }));

  return (
    <MarketingAdminDeferredProvider>
      <MarketingAdminClient
        initial={{
          slides,
          highlights,
          brandRail,
          categoryTiles,
          announcements,
          settings,
          categories,
          products: productsPlain,
          brands,
        }}
      />
      <Suspense fallback={null}>
        <MarketingDeferredSeeds />
      </Suspense>
    </MarketingAdminDeferredProvider>
  );
}
