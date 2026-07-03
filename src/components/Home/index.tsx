import FadeInSection from "@/components/ui/FadeInSection";
import HeroBannerSection from "./HeroBannerSection";
import type { HeroSlide } from "./heroTypes";
import HomeBrandRailSection from "./HomeBrandRailSection";
import HomeBottomTrustBar from "./HomeBottomTrustBar";
import HomeCategoryTilesSection from "./HomeCategoryTilesSection";
import HomeHighlightsSection from "./HomeHighlightsSection";
import HomeNewsletterBanner from "./HomeNewsletterBanner";
import HomeStatsBar from "./HomeStatsBar";
import HomeTrustBar from "./HomeTrustBar";
import HomeWhyChooseRow from "./HomeWhyChooseRow";
import HomeSectionHeader from "./shared/HomeSectionHeader";
import HomeProductRail from "./shared/HomeProductRail";
import type { HomeProductCardItem } from "./shared/HomeProductCard";
import { HOME_SECTION_INNER, HOME_SECTION_SHELL } from "./shared/homeRailStyles";
import type { SiteChromeColors } from "@/lib/marketing/chromeColors";
import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

export type HomeBrandRailItem = {
  id: string;
  href: string;
  image: string;
  label: string;
  alt: string;
};

export type HomeHighlightCard = {
  id: string;
  href: string;
  image: string;
  label: string;
  alt: string;
  subtitle?: string | null;
};

export type HomeCategoryTile = {
  id: string;
  name: string;
  slug: string;
  /** Set when tile is managed in Admin → Marketing (Discover by category). */
  image?: string | null;
};

/** @deprecated Use HomeProductCardItem from shared/HomeProductCard */
export type HomeProductCard = HomeProductCardItem;

type HomeProps = {
  heroSlides?: HeroSlide[];
  heroOverlay?: {
    eyebrow?: string;
    heading?: string;
    subheading?: string;
    ctaLabel?: string;
    ctaHref?: string;
    eyebrowColor?: string;
    headingColor?: string;
    subheadingColor?: string;
    ctaLabelColor?: string;
  };
  /** Auto-advance interval for multi-slide hero (ms). */
  heroCarouselIntervalMs?: number;
  /** Small label above the highlights carousel (defaults if omitted). */
  highlightsSectionEyebrow?: string;
  /** Main heading under the label (defaults if omitted). */
  highlightsSectionHeading?: string;
  highlights?: HomeHighlightCard[];
  brandRail?: HomeBrandRailItem[];
  categories?: HomeCategoryTile[];
  newArrivals?: HomeProductCardItem[];
  bestSellers?: HomeProductCardItem[];
  featuredReview?: HomeFeaturedReview | null;
  footerChrome?: Pick<SiteChromeColors, "footerBg" | "footerText">;
};

const Home = ({
  heroSlides,
  heroOverlay,
  heroCarouselIntervalMs,
  highlightsSectionEyebrow = "Highlights",
  highlightsSectionHeading = "Featured collections and picks.",
  highlights,
  brandRail,
  categories,
  newArrivals,
  bestSellers,
  featuredReview,
  footerChrome,
}: HomeProps) => {
  const spotlightItems = highlights && highlights.length > 0 ? highlights : null;

  return (
    <main className="bg-white">
      <FadeInSection>
        <section className="relative overflow-hidden pt-32">
          <HeroBannerSection
            slides={heroSlides}
            overlay={heroOverlay}
            autoRotateIntervalMs={heroCarouselIntervalMs}
          />
        </section>
      </FadeInSection>

      <FadeInSection>
        <HomeTrustBar />
      </FadeInSection>

      <FadeInSection className="overflow-visible">
        <HomeCategoryTilesSection categories={categories ?? null} />
      </FadeInSection>

      <FadeInSection>
        <section className={HOME_SECTION_SHELL}>
          <div className={HOME_SECTION_INNER}>
            <HomeSectionHeader title="New Arrivals" viewAllHref="/shop" />
            <HomeProductRail
              railId="home-new-arrivals-rail"
              items={newArrivals ?? []}
              showNewBadge
              emptyMessage="No new arrivals yet — add products in Admin."
            />
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="overflow-visible bg-gray-50 py-12 md:py-14">
          <div className={HOME_SECTION_INNER}>
            <HomeHighlightsSection
              items={spotlightItems}
              sectionEyebrow={highlightsSectionEyebrow}
              sectionHeading={highlightsSectionHeading}
            />
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className={`${HOME_SECTION_SHELL} pb-4 md:pb-6`}>
          <div className={HOME_SECTION_INNER}>
            <HomeSectionHeader title="Best Sellers" viewAllHref="/shop" />
            <HomeProductRail
              railId="home-best-sellers-rail"
              items={bestSellers ?? []}
              showSaleBadge
              emptyMessage="No best sellers yet — orders will populate this section."
            />
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <HomeBrandRailSection items={brandRail ?? null} />
      </FadeInSection>

      <FadeInSection>
        <HomeStatsBar
          footerBg={footerChrome?.footerBg}
          footerText={footerChrome?.footerText}
        />
      </FadeInSection>

      <FadeInSection>
        <HomeWhyChooseRow featuredReview={featuredReview} />
      </FadeInSection>

      <FadeInSection>
        <HomeNewsletterBanner
          footerBg={footerChrome?.footerBg}
          footerText={footerChrome?.footerText}
        />
      </FadeInSection>

      <FadeInSection>
        <HomeBottomTrustBar />
      </FadeInSection>
    </main>
  );
};

export default Home;
