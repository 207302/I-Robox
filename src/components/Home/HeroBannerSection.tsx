import dynamic from "next/dynamic";
import HeroBannerLcp from "./HeroBannerLcp";
import type { HeroSlide } from "./HeroBannerCarousel";

const HeroBannerCarousel = dynamic(() => import("./HeroBannerCarousel"), {
  loading: () => (
    <div
      className="relative w-full aspect-[3/2] lg:aspect-[2.7/1] animate-pulse bg-gray-2"
      aria-hidden
    />
  ),
});

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
  slides?: HeroSlide[];
  overlay?: Overlay;
};

/** Server shell: single-slide LCP without client JS; multi-slide loads carousel lazily. */
export default function HeroBannerSection({ slides = [], overlay }: Props) {
  if (slides.length === 0) {
    return (
      <div className="relative w-full">
        <div
          className="relative flex w-full aspect-[3/2] lg:aspect-[2.7/1] items-center justify-center bg-gray-1 border-b border-gray-3"
          aria-label="Hero banner area"
        >
          <p className="max-w-md px-4 text-center text-sm leading-relaxed text-meta-3">
            No hero banners yet. Add slides under{" "}
            <span className="font-medium text-dark">Admin → Marketing → Hero</span>.
          </p>
        </div>
      </div>
    );
  }

  if (slides.length === 1) {
    return (
      <div className="relative w-full">
        <HeroBannerLcp slide={slides[0]} overlay={overlay} />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <HeroBannerCarousel slides={slides} overlay={overlay} />
    </div>
  );
}
