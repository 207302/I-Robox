import Image from "next/image";
import Link from "next/link";
import { heroOverlayTextStyle } from "@/lib/marketing/heroOverlayColors";
import type { HeroSlide } from "./HeroBannerCarousel";

type Overlay = {
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

type Props = {
  slide: HeroSlide;
  overlay?: Overlay;
};

/** Server-rendered LCP candidate — first hero slide + overlay (no client JS). */
export default function HeroBannerLcp({ slide, overlay }: Props) {
  const overlayCopy = {
    eyebrow: overlay?.eyebrow?.trim() ?? "",
    heading: overlay?.heading?.trim() ?? "",
    subheading: overlay?.subheading?.trim() ?? "",
    ctaLabel: overlay?.ctaLabel?.trim() ?? "",
    ctaHref: overlay?.ctaHref?.trim() ?? "",
  };
  const hasOverlayCopy =
    Boolean(overlayCopy.eyebrow) ||
    Boolean(overlayCopy.heading) ||
    Boolean(overlayCopy.subheading);
  const showCta = Boolean(overlayCopy.ctaLabel && overlayCopy.ctaHref);
  const eyebrowStyle = heroOverlayTextStyle(overlay?.eyebrowColor);
  const headingStyle = heroOverlayTextStyle(overlay?.headingColor);
  const subheadingStyle = heroOverlayTextStyle(overlay?.subheadingColor);
  const ctaLabelStyle = heroOverlayTextStyle(overlay?.ctaLabelColor);

  const imageInner = (
    <Image
      src={slide.image_url}
      alt={slide.title ?? "Hero banner"}
      fill
      priority
      fetchPriority="high"
      sizes="100vw"
      className="object-cover"
    />
  );

  return (
    <div
      className="relative w-full touch-pan-y aspect-[3/2] lg:aspect-[2.7/1]"
      aria-label="Hero banner"
    >
      <div className="absolute inset-0 overflow-hidden">
        {slide.link_url ? (
          <Link href={slide.link_url} className="relative block h-full w-full">
            {imageInner}
          </Link>
        ) : (
          <div className="relative h-full w-full">{imageInner}</div>
        )}
      </div>

      {hasOverlayCopy || showCta ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[15] w-[88%] bg-gradient-to-r from-black/80 via-black/45 to-transparent sm:w-[70%] lg:w-[52%]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[16] flex w-full items-center">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 xl:px-0">
              <div className="max-w-xl text-white">
                {overlayCopy.eyebrow ? (
                  <p
                    style={eyebrowStyle}
                    className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs ${eyebrowStyle ? "" : "text-white/90"}`}
                  >
                    {overlayCopy.eyebrow}
                  </p>
                ) : null}
                {overlayCopy.heading ? (
                  <h1
                    style={headingStyle}
                    className={`text-2xl font-semibold leading-[1.08] drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)] sm:text-4xl sm:font-extrabold sm:drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] lg:text-6xl ${headingStyle ? "" : "text-white/95"}`}
                  >
                    {overlayCopy.heading}
                  </h1>
                ) : null}
                {overlayCopy.subheading ? (
                  <p
                    style={subheadingStyle}
                    className={`mt-3 max-w-lg text-sm leading-relaxed sm:text-base lg:text-lg ${subheadingStyle ? "" : "text-white/80 sm:text-white/90"}`}
                  >
                    {overlayCopy.subheading}
                  </p>
                ) : null}
                {showCta ? (
                  <div className="pointer-events-auto mt-5">
                    <Link
                      href={overlayCopy.ctaHref}
                      style={ctaLabelStyle}
                      className={`inline-flex items-center rounded-lg bg-red px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/25 transition hover:bg-red-dark sm:px-6 sm:py-3 sm:text-base ${ctaLabelStyle ? "" : "text-white"}`}
                    >
                      {overlayCopy.ctaLabel}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
