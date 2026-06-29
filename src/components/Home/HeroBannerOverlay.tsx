import Link from "next/link";
import { Shield, Truck, RotateCcw } from "lucide-react";
import { heroOverlayTextStyle } from "@/lib/marketing/heroOverlayColors";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import { HERO_OVERLAY_TRUST_BADGES } from "./heroLayout";

const TRUST_ICONS = [Shield, Truck, RotateCcw] as const;

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
      <div className="pointer-events-none absolute inset-0 z-[15] bg-gradient-to-r from-black/60 via-black/25 to-transparent md:inset-y-0 md:left-0 md:w-1/2 md:from-black/60 md:via-black/40 md:to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-[16] flex items-end pb-10 md:items-center md:pb-0">
        <div className="w-full max-w-7xl px-4 sm:px-8 xl:mx-auto xl:px-0">
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
                className={`line-clamp-3 text-2xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl ${headingStyle ? "" : "text-white"}`}
              >
                {overlayCopy.heading}
              </h1>
            ) : null}
            {overlayCopy.subheading ? (
              <p
                style={subheadingStyle}
                className={`mt-3 max-w-lg text-sm leading-relaxed sm:text-base ${subheadingStyle ? "" : "text-white/85"}`}
              >
                {overlayCopy.subheading}
              </p>
            ) : null}
            {showCta ? (
              <div className="pointer-events-auto mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={overlayCopy.ctaHref}
                  prefetch={shouldPrefetchHref(overlayCopy.ctaHref)}
                  style={ctaLabelStyle}
                  className={`inline-flex items-center rounded-lg bg-red px-5 py-2.5 text-sm font-semibold shadow-lg transition-all duration-200 hover:bg-red-dark sm:px-6 sm:py-3 ${ctaLabelStyle ? "" : "text-white"}`}
                >
                  {overlayCopy.ctaLabel}
                </Link>
                <Link
                  href="/shop"
                  prefetch={shouldPrefetchHref("/shop")}
                  className="inline-flex items-center rounded-lg border border-white/70 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 sm:px-6 sm:py-3"
                >
                  Browse All
                </Link>
              </div>
            ) : null}
            <ul className="pointer-events-none mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
              {HERO_OVERLAY_TRUST_BADGES.map((badge, index) => {
                const Icon = TRUST_ICONS[index] ?? Shield;
                return (
                  <li key={badge.label} className="flex items-center gap-1.5 text-xs text-white/90 sm:text-sm">
                    <Icon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                    <span>{badge.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
