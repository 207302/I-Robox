import Image from "next/image";
import Link from "next/link";
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

export default function HeroBannerSection({ slides = [], overlay }: Props) {
  const first = slides[0];

  if (!first) {
    return <HeroBannerCarousel slides={slides} overlay={overlay} skipFirstSlideImage />;
  }

  const lcpImage = first.link_url ? (
    <Link href={first.link_url} className="relative block h-full w-full">
      <Image
        src={first.image_url}
        alt={first.title ?? "Hero banner"}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
    </Link>
  ) : (
    <Image
      src={first.image_url}
      alt={first.title ?? "Hero banner"}
      fill
      priority
      sizes="100vw"
      className="object-cover"
    />
  );

  return (
    <div className="relative w-full aspect-[3/2] lg:aspect-[2.7/1]">
      <div className="absolute inset-0 z-0">{lcpImage}</div>
      <div className="relative z-[1]">
        <HeroBannerCarousel slides={slides} overlay={overlay} skipFirstSlideImage />
      </div>
    </div>
  );
}
