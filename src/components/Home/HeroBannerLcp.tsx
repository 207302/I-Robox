import HeroBannerOverlay, { type HeroOverlayProps } from "./HeroBannerOverlay";
import HeroSlideImage from "./HeroSlideImage";
import type { HeroSlide } from "./heroTypes";
import { heroSlideImageProps } from "@/lib/images/heroLcpImage";

type Props = {
  slide: HeroSlide;
  overlay?: HeroOverlayProps;
};

/** Server-rendered LCP candidate — first hero slide + overlay (no client JS). */
export default function HeroBannerLcp({ slide, overlay }: Props) {
  const { mobileSrc } = heroSlideImageProps(slide.image_url, true);
  return (
    <div
      className="relative w-full touch-pan-y overflow-hidden aspect-[7/5] lg:aspect-[16/5.5]"
      aria-label="Hero banner"
    >
      <div className="absolute inset-0 overflow-hidden">
        <HeroSlideImage slide={slide} isLcp mobileSrc={mobileSrc} />
      </div>
      <HeroBannerOverlay overlay={overlay} />
    </div>
  );
}
