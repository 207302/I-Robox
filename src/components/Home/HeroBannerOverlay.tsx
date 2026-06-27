import Link from "next/link";
import { heroOverlayTextStyle } from "@/lib/marketing/heroOverlayColors";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";

export type HeroOverlayProps = {
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

export default function HeroBannerOverlay({ overlay }: { overlay?: HeroOverlayProps }) {
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
  if (!hasOverlayCopy && !showCta) return null;

  const eyebrowStyle = heroOverlayTextStyle(overlay?.eyebrowColor);
  const headingStyle = heroOverlayTextStyle(overlay?.headingColor);
  const subheadingStyle = heroOverlayTextStyle(overlay?.subheadingColor);
  const ctaLabelStyle = heroOverlayTextStyle(overlay?.ctaLabelColor);

  return (
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
                  prefetch={shouldPrefetchHref(overlayCopy.ctaHref)}
                  style={ctaLabelStyle}
                  className={`inline-flex items-center rounded-lg bg-red px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/25 transition-all duration-200 hover:bg-red-dark sm:px-6 sm:py-3 sm:text-base ${ctaLabelStyle ? "" : "text-white"}`}
                >
                  {overlayCopy.ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
