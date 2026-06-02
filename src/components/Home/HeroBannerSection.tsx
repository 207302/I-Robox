import HeroBannerLcp from "./HeroBannerLcp";
import HeroBannerMulti from "./HeroBannerMulti";
import type { HeroSlide } from "./heroTypes";
import type { HeroOverlayProps } from "./HeroBannerOverlay";

type Props = {
  slides?: HeroSlide[];
  overlay?: HeroOverlayProps;
  autoRotateIntervalMs?: number;
};

/** Server shell: LCP in HTML; multi-slide uses server images + thin client opacity shell. */
export default function HeroBannerSection({
  slides = [],
  overlay,
  autoRotateIntervalMs,
}: Props) {
  if (slides.length === 0) {
    return (
      <div className="relative w-full bg-gray-1">
        <div
          className="relative flex w-full aspect-[7/5] lg:aspect-[2.7/1] items-center justify-center bg-gray-1 border-b border-gray-3"
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
      <div className="relative w-full bg-gray-1">
        <HeroBannerLcp slide={slides[0]} overlay={overlay} />
      </div>
    );
  }

  return (
    <div className="relative w-full bg-gray-1">
      <HeroBannerMulti
        slides={slides}
        overlay={overlay}
        autoRotateIntervalMs={autoRotateIntervalMs}
      />
    </div>
  );
}
