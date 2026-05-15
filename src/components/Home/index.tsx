import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/utils/formatePrice";
import HeroBannerCarousel, { type HeroSlide } from "./HeroBannerCarousel";
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

function isRemoteImage(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

const Home = ({
  heroSlides,
  heroOverlay,
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
        <HeroBannerCarousel slides={heroSlides} overlay={heroOverlay} />
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
                loading="lazy"
                sizes="28px"
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
              Cards below are managed in Admin → Marketing (featured, trending, categories, or
              individual products).
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
            <Link href="/shop" className="text-sm font-medium text-blue hover:underline">
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
            <Link href="/shop" className="text-sm font-medium text-blue hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(bestSellers ?? []).map((p, index) => (
              <Link
                key={p.id}
                href={`/shop/${p.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-3 bg-white hover:border-blue/40"
              >
                <div className="relative aspect-square bg-gray-2">
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                    unoptimized={isRemoteImage(p.image)}
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : undefined}
                    loading={index === 0 ? undefined : "lazy"}
                  />
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold text-dark">{p.title}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    {p.discountedPrice != null ? (
                      <>
                        <span className="text-sm font-semibold text-blue">{formatPrice(p.discountedPrice)}</span>
                        <span className="text-xs line-through text-meta-4">{formatPrice(p.price)}</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-dark">{formatPrice(p.price)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-gray-1 border-y border-gray-3">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
          <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
                Shop by brand
              </p>
              <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
                Browse by maker or universe.
              </h2>
              <p className="mt-1 text-sm text-meta-3">
                Tiles and images are managed in Admin → Marketing → Shop by brand.
              </p>
            </div>
            <p className="text-xs text-meta-4 sm:text-sm">
              Scroll sideways on mobile to see more brands.
            </p>
          </div>

          <div className="relative">
            <div className="flex gap-4 px-1 pb-2 overflow-x-auto sm:px-0 sm:gap-5 no-scrollbar">
              {brandRail && brandRail.length > 0 ? (
                brandRail.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="min-w-[200px] sm:min-w-[240px] flex flex-col shrink-0 text-left"
                  >
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 640px) 200px, 240px"
                        className="object-cover rounded-2xl"
                        unoptimized={isRemoteImage(item.image)}
                        priority={index === 0}
                        fetchPriority={index === 0 ? "high" : undefined}
                        loading={index === 0 ? undefined : "lazy"}
                      />
                    </div>
                    <div className="mt-2 w-full rounded-xl bg-white border border-gray-3 px-3 py-2 shadow-sm flex items-center justify-center">
                      <span className="text-xs sm:text-sm font-semibold text-dark text-center">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-meta-3 py-4">
                  No brand tiles yet — add them under Admin → Marketing → Shop by brand.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
          <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
                Categories
              </p>
              <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
                Discover by category.
              </h2>
              <p className="mt-1 text-sm text-meta-3">
                Choose categories, order, and photos in Admin → Marketing → Discover by category. If none
                are configured, the first eight catalog categories show here without images.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories && categories.length > 0 ? (
              categories.map((cat, index) => (
                <Link
                  key={cat.id}
                  href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                  className="flex flex-col h-full overflow-hidden rounded-2xl bg-gray-1 border border-gray-3 hover:border-blue/40 hover:shadow-sm transition"
                >
                  {cat.image ? (
                    <div className="relative aspect-[5/3] w-full shrink-0 bg-gray-2">
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover"
                        unoptimized={isRemoteImage(cat.image)}
                        priority={index === 0}
                        fetchPriority={index === 0 ? "high" : undefined}
                        loading={index === 0 ? undefined : "lazy"}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col flex-1 justify-between px-4 py-4">
                    <h3 className="text-sm font-semibold text-dark sm:text-base">{cat.name}</h3>
                    <p className="mt-2 text-[11px] text-meta-3">View products in this category.</p>
                  </div>
                </Link>
              ))
            ) : (
              Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col justify-between h-full px-4 py-5 rounded-2xl bg-gray-1 border border-gray-3"
                >
                  <h3 className="text-sm font-semibold text-dark sm:text-base">
                    Category placeholder {index + 1}
                  </h3>
                  <p className="mt-2 text-[11px] text-meta-3">
                    Add categories in admin to populate this grid.
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

    </main>
  );
};

export default Home;
