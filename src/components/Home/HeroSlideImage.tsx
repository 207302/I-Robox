"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import {
  HERO_IMAGE_SIZES,
  heroSlideImageProps,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/heroLcpImage";
import type { HeroSlide } from "./heroTypes";

type Props = {
  slide: HeroSlide;
  isLcp: boolean;
  /** Fired when the LCP slide has decoded — used to delay carousel auto-advance. */
  onLcpLoaded?: () => void;
};

const FILL_IMG_STYLE = {
  position: "absolute" as const,
  height: "100%",
  width: "100%",
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  color: "transparent",
};

/** Hero slide image (LCP candidate when isLcp). */
export default function HeroSlideImage({ slide, isLcp, onLcpLoaded }: Props) {
  const notifyLcpReady = useCallback(() => {
    onLcpLoaded?.();
  }, [onLcpLoaded]);

  const imageUrl = slide.image_url?.trim();
  if (!imageUrl) return null;

  const srcSet = slide.image_srcSet?.trim();
  const useResponsiveNativeImg =
    Boolean(srcSet) && isCloudinaryDeliveryUrl(imageUrl);

  const img = useResponsiveNativeImg ? (
    // next/image ignores custom srcSet on unoptimized Cloudinary URLs — native img keeps sizes/srcSet in HTML.
    <img
      alt={slide.title ?? "Hero banner"}
      src={imageUrl}
      srcSet={srcSet}
      sizes={HERO_IMAGE_SIZES}
      decoding="async"
      fetchPriority={isLcp ? "high" : "auto"}
      loading={isLcp ? "eager" : "lazy"}
      className="object-cover"
      style={FILL_IMG_STYLE}
      onLoad={isLcp ? notifyLcpReady : undefined}
      onError={isLcp ? notifyLcpReady : undefined}
    />
  ) : (
    <Image
      {...heroSlideImageProps(imageUrl, srcSet, isLcp)}
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
