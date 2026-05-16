import HeroBannerCarousel, { type HeroSlide } from "./HeroBannerCarousel";

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

/** Aspect-ratio shell; carousel handles image, overlay, and controls in one stack. */
export default function HeroBannerSection({ slides = [], overlay }: Props) {
  return (
    <div className="relative w-full">
      <HeroBannerCarousel slides={slides} overlay={overlay} />
    </div>
  );
}
