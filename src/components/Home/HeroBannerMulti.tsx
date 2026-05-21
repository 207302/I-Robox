import HeroBannerOverlay, { type HeroOverlayProps } from "./HeroBannerOverlay";
import HeroCarouselClient from "./HeroCarouselClient";
import HeroSlideImage from "./HeroSlideImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slides: HeroSlide[];
  overlay?: HeroOverlayProps;
};

/** Multi-slide hero: LCP image in server HTML; client shell only toggles opacity. */
export default function HeroBannerMulti({ slides, overlay }: Props) {
  const slidesKey = slides.map((s) => s.id).join("|");

  return (
    <div className="relative w-full">
      <HeroCarouselClient slideCount={slides.length} slidesKey={slidesKey}>
        {slides.map((slide, index) => (
          <HeroSlideImage key={slide.id} slide={slide} isLcp={index === 0} />
        ))}
      </HeroCarouselClient>
      <HeroBannerOverlay overlay={overlay} />
    </div>
  );
}
