"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
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
  const notifyLcpReady = useCallback(() => {
    onLcpLoaded?.();
  }, [onLcpLoaded]);

  const imageUrl = slide.image_url?.trim();
  if (!imageUrl) return null;

  const img = (
    <Image
      {...heroSlideImageProps(imageUrl, isLcp)}
      alt={slide.title ?? "Hero banner"}
      fill
      className="object-cover"
      onLoad={isLcp ? notifyLcpReady : undefined}
      onLoadingComplete={isLcp ? notifyLcpReady : undefined}
      onError={isLcp ? notifyLcpReady : undefined}
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
