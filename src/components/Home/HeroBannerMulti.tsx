import HeroBannerOverlay, { type HeroOverlayProps } from "./HeroBannerOverlay";
import HeroCarouselClient from "./HeroCarouselClient";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slides: HeroSlide[];
  overlay?: HeroOverlayProps;
};

/** Multi-slide hero: first slide is LCP; adjacent slides mount on demand to limit Cloudinary burst. */
export default function HeroBannerMulti({ slides, overlay }: Props) {
  return (
    <div className="relative w-full">
      <HeroCarouselClient slides={slides} />
      <HeroBannerOverlay overlay={overlay} />
    </div>
  );
}
