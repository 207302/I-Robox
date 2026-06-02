import Image from "next/image";
import Link from "next/link";
import HeroBannerSection from "./HeroBannerSection";
import HomeProductCard from "./shared/HomeProductCard";
import type { HeroSlide } from "./heroTypes";
import HomeBrandRailSection from "./HomeBrandRailSection";
import HomeCategoryTilesSection from "./HomeCategoryTilesSection";
import HomeHighlightsSection from "./HomeHighlightsSection";
import HomeProductCarouselSection from "./HomeProductCarouselSection";

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

export type HomeProductCard = {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  discountedPrice?: number | null;
};

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
  newArrivals?: HomeProductCard[];
  bestSellers?: HomeProductCard[];
};

const TRUST_BAR_ITEMS = [
  {
    icon: "/images/icons/icon-01.svg",
    title: "Fast Delivery",
    subtitle: "Across India",
  },
  {
    icon: "/images/icons/icon-03.svg",
    title: "100% Original",
    subtitle: "Products",
  },
  {
    icon: "/images/icons/icon-02.svg",
    title: "Easy Returns",
    subtitle: "7 Days Policy",
  },
  {
    icon: "/images/icons/icon-04.svg",
    title: "Secure Payment",
    subtitle: "Multiple Options",
  },
] as const;

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
}: HomeProps) => {
  const spotlightItems =
    highlights && highlights.length > 0
      ? highlights
      : null;

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden pt-32">
        <HeroBannerSection
          slides={heroSlides}
          overlay={heroOverlay}
          autoRotateIntervalMs={heroCarouselIntervalMs}
        />
      </section>

      <section className="border-b border-gray-3 bg-white">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-6 sm:px-8 md:grid-cols-4 md:gap-6 md:py-7">
          {TRUST_BAR_ITEMS.map((item) => (
            <div key={item.title} className="flex items-center gap-3 md:justify-center md:gap-3.5">
              <Image
                src={item.icon}
                alt={item.title}
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 md:h-9 md:w-9"
                sizes="36px"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-dark md:text-[15px]">{item.title}</p>
                <p className="text-xs font-medium leading-tight text-meta-3 md:text-[13px]">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
          <div className="max-w-2xl mx-auto mb-10 text-center">
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
              {highlightsSectionEyebrow}
            </p>
            <h2 className="mb-3 text-2xl font-semibold sm:text-3xl text-dark">
              {highlightsSectionHeading}
            </h2>
            <p className="text-sm leading-relaxed text-meta-3 sm:text-base">
              Curated picks from our catalog.
            </p>
          </div>

          <HomeHighlightsSection items={spotlightItems} />
        </div>
      </section>

      <section className="py-14 bg-gray-1 border-y border-gray-3">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
                New arrivals
              </p>
              <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
                Latest drops in store.
              </h2>
            </div>
            <Link href="/shop" prefetch={false} className="text-sm font-medium text-blue hover:underline">
              View all
            </Link>
          </div>
          <HomeProductCarouselSection items={newArrivals ?? null} />
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
                Best sellers
              </p>
              <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
                Most-loved picks.
              </h2>
            </div>
            <Link href="/shop" prefetch={false} className="text-sm font-medium text-blue hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(bestSellers ?? []).map((p) => (
              <HomeProductCard key={p.id} item={p} />
            ))}
          </div>
        </div>
      </section>

      <HomeBrandRailSection items={brandRail ?? null} />

      <HomeCategoryTilesSection categories={categories ?? null} />

    </main>
  );
};

export default Home;
