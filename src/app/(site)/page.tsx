import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { getHomePageData } from "@/lib/queries/homePage";
import { getFeaturedHomeReviews } from "@/lib/queries/productReviews";
import { getSiteChromeColors } from "@/lib/queries/marketing";
import { withPagePerf } from "@/lib/observability/route";
import Home, {
  type HomeBrandRailItem,
  type HomeCategoryTile,
  type HomeHighlightCard,
} from "@/components/Home";
import type { HomeProductCardItem } from "@/components/Home/shared/HomeProductCard";
import type { HeroSlide } from "@/components/Home/heroTypes";
import {
  cloudinaryCardUrl,
  cloudinaryProductCardUrl,
} from "@/lib/images/cloudinaryDeliver";
import { resolveHeroCarouselIntervalMs } from "@/lib/marketing/heroCarousel";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";
import type { Metadata } from "next";
import { JsonLdScript } from "@/lib/seo/jsonLd";
import { SEO_SITE_URL } from "@/lib/seo/constants";
import { buildSocialMetadata } from "@/lib/seo/metadata";
import HomeHeroLcpPreload from "@/components/Home/HomeHeroLcpPreload";

/** ISR: keep in sync with `HOME_PAGE_REVALIDATE_SECONDS` in homePageCache.ts */
export const revalidate = 300;

const HOME_TITLE = "i-robox | RC Toys, Diecast Models & Collectibles in India";
const HOME_DESCRIPTION =
  "Shop RC cars, diecast models, and collectibles at i-robox. Premium toys delivered across India with secure checkout and fast support.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  ...buildSocialMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
  }),
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "i-robox",
  url: SEO_SITE_URL,
  description: HOME_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SEO_SITE_URL}/shop?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const FALLBACK_HIGHLIGHT_IMAGE = PRODUCT_IMAGE_PLACEHOLDER;

const FALLBACK_PRODUCT_IMAGE = PRODUCT_IMAGE_PLACEHOLDER;

const pickCardImage = (images: { url: string; sort_order: number }[] | undefined) =>
  images && images.length > 0
    ? images.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ??
      FALLBACK_PRODUCT_IMAGE
    : FALLBACK_PRODUCT_IMAGE;

export default async function HomePage() {
  return withPagePerf("page:/", async () => {
  const now = new Date();

  const [{
    siteMarketingSettings,
    categoriesRaw,
    newArrivalsRaw,
    bestSellersRaw,
    slidesRaw,
    highlightsRaw,
    brandRailRaw,
    categoryTilesRaw,
  }, chromeColors, featuredReviewsRaw] = await Promise.all([
    getHomePageData(),
    getSiteChromeColors(),
    getFeaturedHomeReviews(),
  ]);

  const highlightsSectionEyebrow =
    siteMarketingSettings?.highlights_section_eyebrow?.trim() || "Highlights";
  const highlightsSectionHeading =
    siteMarketingSettings?.highlights_section_heading?.trim() || "Featured collections and picks.";
  const heroOverlay = {
    eyebrow: siteMarketingSettings?.hero_overlay_eyebrow?.trim() ?? "",
    heading: siteMarketingSettings?.hero_overlay_heading?.trim() ?? "",
    subheading: siteMarketingSettings?.hero_overlay_subheading?.trim() ?? "",
    ctaLabel: siteMarketingSettings?.hero_overlay_cta_label?.trim() ?? "",
    ctaHref: siteMarketingSettings?.hero_overlay_cta_href?.trim() ?? "",
    eyebrowColor: siteMarketingSettings?.hero_overlay_eyebrow_color?.trim() ?? "",
    headingColor: siteMarketingSettings?.hero_overlay_heading_color?.trim() ?? "",
    subheadingColor: siteMarketingSettings?.hero_overlay_subheading_color?.trim() ?? "",
    ctaLabelColor: siteMarketingSettings?.hero_overlay_cta_label_color?.trim() ?? "",
  };
  const heroCarouselIntervalMs = resolveHeroCarouselIntervalMs(
    siteMarketingSettings?.hero_carousel_interval_ms
  );

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
      // Link target priority (independent of `kind`):
      //   1) link_url override
      //   2) products  → /shop/<slug>
      //   3) brands    → /brand/<slug>
      //   4) categories→ /category/<slug>
      //   5) /shop
      const product = "products" in h ? h.products : undefined;
      const brand = "brands" in h ? h.brands : undefined;
      const category = "categories" in h ? h.categories : undefined;

      let href = (h.link_url ?? "").trim();
      if (!href) {
        if (product?.slug) {
          href = `/shop/${product.slug}`;
        } else if (brand?.slug) {
          href = `/brand/${encodeURIComponent(brand.slug)}`;
        } else if (category?.slug) {
          href = `/category/${encodeURIComponent(category.slug)}`;
        } else {
          href = "/shop";
        }
      }

      let image = h.image_url ?? "";
      if (!image) {
        image = product?.product_images?.[0]?.url ?? FALLBACK_HIGHLIGHT_IMAGE;
      }

      return {
        id: h.id,
        href,
        image: image.startsWith("http") ? cloudinaryCardUrl(image, 384) : image,
        label: h.title,
        alt: h.title,
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
      image: row.image_url ? cloudinaryCardUrl(row.image_url, 640) : null,
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
      href: `/brand/${encodeURIComponent(row.brands!.slug)}`,
      image: cloudinaryCardUrl(row.image_url, 480),
      label: row.label_override?.trim() || row.brands!.name,
      alt: row.brands!.name,
    }));

  const newArrivals: HomeProductCardItem[] = newArrivalsRaw.map((p) => ({
    id: p.id,
    productId: p.id,
    slug: p.slug,
    title: p.title,
    image: cloudinaryProductCardUrl(pickCardImage(p.product_images), 380),
    price: Number(p.price),
    discountedPrice: p.discountedPrice == null ? null : Number(p.discountedPrice),
    averageRating: p.averageRating ?? null,
    reviewCount: p.reviewCount ?? 0,
  }));

  const bestSellers: HomeProductCardItem[] = bestSellersRaw.map((p) => ({
    id: p.id,
    productId: p.id,
    slug: p.slug,
    title: p.title,
    image: cloudinaryProductCardUrl(pickCardImage(p.product_images), 380),
    price: Number(p.price),
    discountedPrice: p.discountedPrice == null ? null : Number(p.discountedPrice),
    averageRating: p.averageRating ?? null,
    reviewCount: p.reviewCount ?? 0,
  }));

  const featuredReviews = featuredReviewsRaw.map((review) => ({
    ...review,
    productImageUrl: review.productImageUrl
      ? cloudinaryProductCardUrl(review.productImageUrl, 192)
      : null,
  }));

  return (
    <>
      <JsonLdScript id="website-jsonld" data={websiteJsonLd} />
      <HomeHeroLcpPreload imageUrl={heroSlides[0]?.image_url} />
      <Home
        heroSlides={heroSlides}
        heroOverlay={heroOverlay}
        heroCarouselIntervalMs={heroCarouselIntervalMs}
        highlightsSectionEyebrow={highlightsSectionEyebrow}
        highlightsSectionHeading={highlightsSectionHeading}
        highlights={highlights}
        brandRail={brandRail}
        categories={categories}
        newArrivals={newArrivals}
        bestSellers={bestSellers}
        featuredReviews={featuredReviews}
        footerChrome={{
          footerBg: chromeColors.footerBg,
          footerText: chromeColors.footerText,
        }}
      />
    </>
  );
  });
}
