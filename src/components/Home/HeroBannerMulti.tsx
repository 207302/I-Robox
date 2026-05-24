import HeroBannerOverlay, { type HeroOverlayProps } from "./HeroBannerOverlay";
import HeroCarouselClient from "./HeroCarouselClient";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slides: HeroSlide[];
  overlay?: HeroOverlayProps;
};

/** Multi-slide hero: horizontal slide track; first slide is LCP. */
export default function HeroBannerMulti({ slides, overlay }: Props) {
  return (
    <div className="relative w-full">
      <HeroCarouselClient slides={slides} />
      <HeroBannerOverlay overlay={overlay} />
    </div>
  );
}
