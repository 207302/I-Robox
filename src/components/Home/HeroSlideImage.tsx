"use client";

import Image from "next/image";
import Link from "next/link";
import { heroSlideImageProps } from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  isLcp: boolean;
  /** Fired when the LCP slide has decoded — used to delay carousel auto-advance. */
  onLcpLoaded?: () => void;
};

/** Hero slide image (LCP candidate when isLcp). */
export default function HeroSlideImage({ slide, isLcp, onLcpLoaded }: Props) {
  const img = (
    <Image
      {...heroSlideImageProps(slide.image_url, slide.image_srcSet, isLcp)}
      alt={slide.title ?? "Hero banner"}
      fill
      className="object-cover"
      onLoad={isLcp ? onLcpLoaded : undefined}
      onError={isLcp ? onLcpLoaded : undefined}
    />
  );

  if (slide.link_url) {
    return (
      <Link href={slide.link_url} className="relative block h-full w-full">
        {img}
      </Link>
    );
  }

  return <div className="relative h-full w-full">{img}</div>;
}
