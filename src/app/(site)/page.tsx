import { prisma } from "@/lib/prismaDB";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { getBestSellingProducts, getNewArrivalsProduct } from "@/get-api-data/product";
import LcpImagePrelink from "@/components/Common/LcpImagePrelink";
import Home, {
  type HomeBrandRailItem,
  type HomeCategoryTile,
  type HomeHighlightCard,
  type HomeProductCard,
} from "@/components/Home";
import type { HeroSlide } from "@/components/Home/HeroBannerCarousel";

/** CMS-driven content must not be prerendered at build time on Vercel (stale until redeploy). */
export const dynamic = "force-dynamic";

const FALLBACK_HIGHLIGHT_IMAGE =
  "/images/collections/693c2377f0a417e6ed0a3758-rc-cars-1-14-all-terrain-rc-car-for.jpg";
const FALLBACK_PRODUCT_IMAGE = "/images/products/placeholder.png";

const pickCardImage = (images: { url: string; sort_order: number }[] | undefined) =>
  images && images.length > 0
    ? images.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ??
      FALLBACK_PRODUCT_IMAGE
    : FALLBACK_PRODUCT_IMAGE;

export default async function HomePage() {
  const now = new Date();

  const highlightsPromise = prisma.homepage_highlights
    .findMany({
      orderBy: { sort_order: "asc" },
      include: {
        categories: { select: { slug: true, name: true } },
        brands: { select: { slug: true, name: true } },
        products: {
          select: {
            slug: true,
            name: true,
            product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    })
    .catch(() =>
      prisma.homepage_highlights.findMany({
        orderBy: { sort_order: "asc" },
        include: {
          categories: { select: { slug: true, name: true } },
          products: {
            select: {
              slug: true,
              name: true,
              product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
            },
          },
        },
      })
    );

  const [
    slidesRaw,
    highlightsRaw,
    brandRailRaw,
    categoryTilesRaw,
    categoriesRaw,
    newArrivalsRaw,
    bestSellersRaw,
    siteMarketingSettings,
  ] = await Promise.all([
      prisma.homepage_hero_slides.findMany({ orderBy: { sort_order: "asc" } }),
      highlightsPromise,
      prisma.homepage_brand_rail
        .findMany({
          orderBy: { sort_order: "asc" },
          include: { brands: { select: { slug: true, name: true } } },
        })
        .catch(() => []),
      prisma.homepage_category_tiles
        .findMany({
          orderBy: { sort_order: "asc" },
          include: { categories: { select: { id: true, name: true, slug: true } } },
        })
        .catch(() => []),
      prisma.categories.findMany({
        orderBy: { name: "asc" },
        take: 8,
        select: { id: true, name: true, slug: true },
      }),
      getNewArrivalsProduct(),
      getBestSellingProducts(),
      prisma.site_marketing_settings
        .findUnique({
          where: { id: SITE_MARKETING_SETTINGS_ID },
          select: {
            highlights_section_eyebrow: true,
            highlights_section_heading: true,
            hero_overlay_eyebrow: true,
            hero_overlay_heading: true,
            hero_overlay_subheading: true,
            hero_overlay_cta_label: true,
            hero_overlay_cta_href: true,
          },
        })
        .catch(() => null),
    ]);

  const highlightsSectionEyebrow =
    siteMarketingSettings?.highlights_section_eyebrow?.trim() || "Highlights";
  const highlightsSectionHeading =
    siteMarketingSettings?.highlights_section_heading?.trim() || "Featured collections and picks.";
  const heroOverlay = {
    eyebrow: siteMarketingSettings?.hero_overlay_eyebrow?.trim() || "Tron Play World",
    heading:
      siteMarketingSettings?.hero_overlay_heading?.trim() ||
      "India's Ultimate Toy & RC Destination",
    subheading:
      siteMarketingSettings?.hero_overlay_subheading?.trim() ||
      "RC cars, anime figures, diecast models, board games, and more.",
    ctaLabel: siteMarketingSettings?.hero_overlay_cta_label?.trim() || "Shop Now",
    ctaHref: siteMarketingSettings?.hero_overlay_cta_href?.trim() || "/shop",
  };

  const heroSlides: HeroSlide[] = slidesRaw
    .filter((s) => isActiveInWindow(s.is_active, s.active_from, s.active_until, now))
    .map((s) => ({
      id: s.id,
      image_url: s.image_url,
      title: s.title,
      link_url: s.link_url,
    }));

  const highlights: HomeHighlightCard[] = highlightsRaw
    .filter((h) => isActiveInWindow(h.is_active, h.active_from, h.active_until, now))
    .map((h) => {
      let href = h.link_url ?? "";
      let image = h.image_url ?? "";
      const label = h.title;
      const alt = h.title;

      if (h.kind === "CATEGORY" && h.categories) {
        if (!href) href = `/shop?category=${encodeURIComponent(h.categories.slug)}`;
        if (!image) image = FALLBACK_HIGHLIGHT_IMAGE;
      } else if (h.kind === "BRAND" && h.brands) {
        if (!href) href = `/shop?brand=${encodeURIComponent(h.brands.slug)}`;
        if (!image) image = FALLBACK_HIGHLIGHT_IMAGE;
      } else if (h.kind === "PRODUCT" && h.products) {
        if (!href) href = `/shop/${h.products.slug}`;
        if (!image) image = h.products.product_images[0]?.url ?? FALLBACK_HIGHLIGHT_IMAGE;
      } else {
        if (!href) href = "/shop";
        if (!image) image = FALLBACK_HIGHLIGHT_IMAGE;
      }

      return {
        id: h.id,
        href,
        image,
        label,
        alt,
        subtitle: h.subtitle,
      };
    });

  const fromCategoryTiles = categoryTilesRaw
    .filter(
      (row) =>
        row.categories &&
        isActiveInWindow(row.is_active, row.active_from, row.active_until, now)
    )
    .map((row) => ({
      id: row.id,
      name: row.label_override?.trim() || row.categories!.name,
      slug: row.categories!.slug,
      image: row.image_url,
    }));

  const categories: HomeCategoryTile[] =
    fromCategoryTiles.length > 0
      ? fromCategoryTiles
      : categoriesRaw.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: null,
        }));

  const brandRail: HomeBrandRailItem[] = brandRailRaw
    .filter(
      (row) =>
        row.brands &&
        isActiveInWindow(row.is_active, row.active_from, row.active_until, now)
    )
    .map((row) => ({
      id: row.id,
      href: `/shop?brand=${encodeURIComponent(row.brands!.slug)}`,
      image: row.image_url,
      label: row.label_override?.trim() || row.brands!.name,
      alt: row.brands!.name,
    }));

  const newArrivals: HomeProductCard[] = newArrivalsRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    image: pickCardImage(p.product_images),
    price: Number(p.price),
    discountedPrice: p.discountedPrice == null ? null : Number(p.discountedPrice),
  }));

  const bestSellers: HomeProductCard[] = bestSellersRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    image: pickCardImage(p.product_images),
    price: Number(p.price),
    discountedPrice: p.discountedPrice == null ? null : Number(p.discountedPrice),
  }));

  const heroLcpUrl = heroSlides[0]?.image_url ?? "";

  return (
    <>
      <LcpImagePrelink
        imageUrl={heroLcpUrl}
        sizes="100vw"
        width={1920}
        height={720}
      />
      <Home
        heroSlides={heroSlides}
        heroOverlay={heroOverlay}
        highlightsSectionEyebrow={highlightsSectionEyebrow}
        highlightsSectionHeading={highlightsSectionHeading}
        highlights={highlights}
        brandRail={brandRail}
        categories={categories}
        newArrivals={newArrivals}
        bestSellers={bestSellers}
      />
    </>
  );
}
