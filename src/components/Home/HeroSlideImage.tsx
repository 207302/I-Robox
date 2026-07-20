"use client";

import Image from "next/image";
import Link from "next/link";
import { heroSlideImageProps } from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  isLcp: boolean;
};

/** Hero slide image (LCP candidate when isLcp). Uses separate mobile image when set. */
export default function HeroSlideImage({ slide, isLcp }: Props) {
  const imageUrl = slide.image_url?.trim();
  if (!imageUrl) return null;
  const {
    src: desktopSrc,
    mobileSrc,
    loading,
    fetchPriority,
  } = heroSlideImageProps(imageUrl, isLcp, slide.mobile_image_url);

  const img = (
    <>
      <Image
        src={mobileSrc}
        alt={slide.title ?? "Hero banner"}
        fill
        className="object-cover object-center md:hidden"
        sizes="(max-width: 767px) 100vw, 0vw"
        priority={isLcp}
        loading={loading}
        fetchPriority={fetchPriority}
        quality={isLcp ? 90 : 85}
      />
      <Image
        src={desktopSrc}
        alt={slide.title ?? "Hero banner"}
        fill
        className="object-cover object-center hidden md:block"
        sizes="(max-width: 767px) 0vw, 1440px"
        priority={isLcp}
        loading={loading}
        fetchPriority={fetchPriority}
        quality={isLcp ? 90 : 85}
      />
    </>
  );

  if (slide.link_url) {
    return (
      <Link href={slide.link_url} className="relative block h-full w-full overflow-hidden">
        {img}
      </Link>
    );
  }

  return <div className="relative h-full w-full overflow-hidden">{img}</div>;
}
