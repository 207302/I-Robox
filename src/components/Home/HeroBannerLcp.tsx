import HeroBannerOverlay, { type HeroOverlayProps } from "./HeroBannerOverlay";
import HeroSlideImage from "./HeroSlideImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  overlay?: HeroOverlayProps;
};

/** Server-rendered LCP candidate — first hero slide + overlay (no client JS). */
export default function HeroBannerLcp({ slide, overlay }: Props) {
  return (
    <div
      className="relative w-full touch-pan-y aspect-[7/5] lg:aspect-[2.7/1]"
      aria-label="Hero banner"
    >
      <div className="absolute inset-0 overflow-hidden">
        <HeroSlideImage slide={slide} isLcp />
      </div>
      <HeroBannerOverlay overlay={overlay} />
    </div>
  );
}
