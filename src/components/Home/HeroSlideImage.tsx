"use client";

import Image from "next/image";
import Link from "next/link";
import { heroSlideImageProps } from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  isLcp: boolean;
};

/** Server-rendered hero slide image (LCP candidate when isLcp). */
export default function HeroSlideImage({ slide, isLcp }: Props) {
  const img = (
    <Image
      {...heroSlideImageProps(slide.image_url, slide.image_srcSet, isLcp)}
      alt={slide.title ?? "Hero banner"}
      fill
      className="object-cover"
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
