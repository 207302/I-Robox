"use client";

import Image from "next/image";
import Link from "next/link";
import { heroSlideImageProps } from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  isLcp: boolean;
};

/** Hero slide image (LCP candidate when isLcp). */
export default function HeroSlideImage({ slide, isLcp }: Props) {
  const imageUrl = slide.image_url?.trim();
  if (!imageUrl) return null;

  const img = (
    <Image
      {...heroSlideImageProps(imageUrl, isLcp)}
      alt={slide.title ?? "Hero banner"}
      fill
      className="object-cover object-center"
      quality={isLcp ? 90 : 85}
    />
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
