"use client";

import Image from "next/image";
import Link from "next/link";
import { heroSlideImageProps } from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  isLcp: boolean;
  mobileSrc: string;
};

/** Hero slide image (LCP candidate when isLcp). */
export default function HeroSlideImage({ slide, isLcp, mobileSrc }: Props) {
  const imageUrl = slide.image_url?.trim();
  if (!imageUrl) return null;
  const {
    src: desktopSrc,
    loading,
    fetchPriority,
  } = heroSlideImageProps(imageUrl, isLcp);

  const img = (
    <>
      <Image
        src={mobileSrc}
        alt={slide.title ?? "Hero banner"}
        fill
        className="object-cover object-center lg:hidden"
        sizes="(max-width: 1023px) 100vw, 0vw"
        priority={isLcp}
        loading={loading}
        fetchPriority={fetchPriority}
        quality={isLcp ? 90 : 85}
      />
      <Image
        src={desktopSrc}
        alt={slide.title ?? "Hero banner"}
        fill
        className="object-cover object-center hidden lg:block"
        sizes="(max-width: 1023px) 0vw, 1440px"
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
