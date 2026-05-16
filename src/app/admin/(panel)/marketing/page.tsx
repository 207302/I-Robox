import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import MarketingAdminClient from "./MarketingAdminClient";

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

  const [
    slides,
    highlights,
    brandRail,
    categoryTiles,
    announcements,
    popups,
    flashSales,
    settings,
    categories,
    products,
    brands,
    coupons,
  ] = await Promise.all([
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
      prisma.marketing_popups.findMany({ orderBy: { sort_priority: "asc" } }).catch(() => []),
      prisma.flash_sale_products
        .findMany({
          orderBy: { updated_at: "desc" },
          include: { products: { select: { name: true, slug: true } } },
        })
        .catch(() => []),
      prisma.site_marketing_settings
        .findUnique({
          where: { id: SITE_MARKETING_SETTINGS_ID },
        })
        .catch(() => null),
      prisma.categories
        .findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        })
        .catch(() => []),
      prisma.products
        .findMany({
          orderBy: { name: "asc" },
          take: 600,
          select: { id: true, name: true, slug: true, base_price: true, discounted_price: true },
        })
        .catch(() => []),
      prisma.brands
        .findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        })
        .catch(() => []),
      prisma.coupons
        .findMany({
          orderBy: { code: "asc" },
          select: { id: true, code: true, discount_type: true, discount_value: true, is_active: true },
        })
        .catch(() => []),
    ]);

  const flashSalesPlain = flashSales.map((row) => ({
    ...row,
    sale_price: Number(row.sale_price),
  }));
  const productsPlain = products.map((p) => ({
    ...p,
    base_price: Number(p.base_price),
    discounted_price: p.discounted_price != null ? Number(p.discounted_price) : null,
  }));

  const couponsPlain = coupons.map((c) => ({
    ...c,
    discount_value: Number(c.discount_value),
  }));

  return (
    <MarketingAdminClient
      initial={{
        slides,
        highlights,
        brandRail,
        categoryTiles,
        announcements,
        popups,
        flashSales: flashSalesPlain,
        settings,
        categories,
        products: productsPlain,
        brands,
        coupons: couponsPlain,
      }}
    />
  );
}
