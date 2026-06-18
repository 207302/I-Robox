"use client";

import { usePreviewSlider } from "@/app/context/PreviewSliderContext";
import { FullScreenIcon } from "@/assets/icons";
import SafeProductImage from "@/components/Common/SafeProductImage";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";
import { productImageAlt } from "@/lib/seo/metadata";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";

const SWIPE_THRESHOLD = 40;
/** Auto-advance main image when there are multiple photos */
const AUTO_ADVANCE_MS = 4500;
/** Main stage slide animation */
const SLIDE_MS = 600;

/** Scroll thumbnail rail horizontally only — avoids scrollIntoView jumping the page on mobile */
function scrollThumbnailIntoRail(rail: HTMLDivElement, thumb: HTMLElement) {
  const targetLeft = thumb.offsetLeft - (rail.clientWidth - thumb.offsetWidth) / 2;
  const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
  rail.scrollTo({
    left: Math.max(0, Math.min(targetLeft, maxScroll)),
    behavior: "smooth",
  });
}

type Props = {
  title: string;
  images: string[];
  galleryId?: string;
};

export default function DemoProductGallery({ title, images, galleryId = "default" }: Props) {
  const { openPreviewModal } = usePreviewSlider();
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const galleryRootRef = useRef<HTMLDivElement>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const autoplayPausedRef = useRef(false);
  const galleryVisibleRef = useRef(true);
  const skipThumbScrollIntoViewRef = useRef(true);

  const goTo = (index: number) => {
    const total = images.length;
    setActiveIndex(((index % total) + total) % total);
  };

  const openLightbox = useCallback(
    (index = activeIndex) => {
      openPreviewModal(index, { images, title });
    },
    [activeIndex, images, openPreviewModal, title]
  );

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    didSwipeRef.current = false;
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const touchEndX = event.changedTouches[0]?.clientX;
    if (typeof touchEndX !== "number") return;

    const deltaX = touchEndX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    didSwipeRef.current = true;
    if (deltaX < 0) goTo(activeIndex + 1);
    else goTo(activeIndex - 1);
  };

  const handleMainImageClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    openLightbox(activeIndex);
  };

  const scrollThumbnails = (direction: "left" | "right") => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const amount = Math.max(rail.clientWidth * 0.75, 180);
    rail.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const onSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{
        galleryId?: string;
        image?: string;
        index?: number;
      }>;
      if (customEvent.detail?.galleryId !== galleryId) return;
      const targetIndex = customEvent.detail?.index;
      if (typeof targetIndex === "number" && Number.isFinite(targetIndex)) {
        goTo(targetIndex);
        return;
      }
      const image = customEvent.detail?.image;
      if (!image) return;
      const idx = images.indexOf(image);
      if (idx >= 0) {
        goTo(idx);
      }
    };

    window.addEventListener("product-gallery-select-image", onSelect as EventListener);
    return () => {
      window.removeEventListener("product-gallery-select-image", onSelect as EventListener);
    };
  }, [galleryId, images]);

  useEffect(() => {
    if (images.length === 0) return;
    setActiveIndex((i) => Math.min(i, images.length - 1));
  }, [images.length, images.join("|")]);

  useEffect(() => {
    const root = galleryRootRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        galleryVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.15 }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const id = window.setInterval(() => {
      if (autoplayPausedRef.current || !galleryVisibleRef.current) return;
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [images.length, images.join("|")]);

  useEffect(() => {
    const rail = thumbnailRailRef.current;
    if (!rail || images.length <= 1 || !galleryVisibleRef.current) return;
    if (skipThumbScrollIntoViewRef.current) {
      skipThumbScrollIntoViewRef.current = false;
      return;
    }
    const thumb = rail.querySelector<HTMLElement>(`[data-thumb-index="${activeIndex}"]`);
    if (thumb) scrollThumbnailIntoRail(rail, thumb);
  }, [activeIndex, images.length]);

  return (
    <div
      ref={galleryRootRef}
      className="w-full max-w-full space-y-3 overflow-x-hidden sm:space-y-4"
      onPointerEnter={() => {
        autoplayPausedRef.current = true;
      }}
      onPointerLeave={() => {
        autoplayPausedRef.current = false;
      }}
    >
      <div
        className="relative w-full aspect-square overflow-hidden rounded-2xl border border-gray-3 bg-gray-1 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => openLightbox(activeIndex)}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-3 bg-white/95 text-dark shadow-sm transition hover:bg-white sm:right-4 sm:top-4"
          aria-label="Open fullscreen image viewer"
        >
          <FullScreenIcon />
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={handleMainImageClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openLightbox(activeIndex);
            }
          }}
          className="absolute inset-0 z-[1] cursor-zoom-in"
          aria-label={`View ${title} image ${activeIndex + 1} in fullscreen`}
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goTo(activeIndex - 1);
              }}
              className="absolute left-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-3 bg-white/95 text-dark shadow-sm transition hover:bg-white sm:left-3 sm:h-10 sm:w-10"
              aria-label="Previous image"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M10 3.5L5.5 8L10 12.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goTo(activeIndex + 1);
              }}
              className="absolute right-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-3 bg-white/95 text-dark shadow-sm transition hover:bg-white sm:right-3 sm:h-10 sm:w-10"
              aria-label="Next image"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 3.5L10.5 8L6 12.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div
              className="absolute inset-0 flex h-full transition-transform motion-reduce:transition-none"
              style={{
                width: `${images.length * 100}%`,
                transform: `translateX(-${(activeIndex * 100) / images.length}%)`,
                transitionDuration: `${SLIDE_MS}ms`,
                transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {images.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="relative h-full shrink-0"
                  style={{ width: `${100 / images.length}%` }}
                >
                  <SafeProductImage
                    src={resolveProductImageSrc(src)}
                    alt={index === 0 ? productImageAlt(title) : `${title} — view ${index + 1} | i-robox`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain p-2 sm:p-4"
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : undefined}
                    loading={index === 0 ? undefined : "lazy"}
                  />
                </div>
              ))}
            </div>
          </>
        ) : images[0] ? (
          <SafeProductImage
            src={resolveProductImageSrc(images[0])}
            alt={productImageAlt(title)}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain p-2 sm:p-4"
            priority
            fetchPriority="high"
          />
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="flex min-h-[4.5rem] items-center gap-2 sm:min-h-24">
          <button
            type="button"
            onClick={() => scrollThumbnails("left")}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-3 bg-white text-dark shadow-sm transition hover:bg-gray-1 sm:inline-flex"
            aria-label="Scroll thumbnails left"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3.5L5.5 8L10 12.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="min-w-0 flex-1 overflow-x-hidden">
            <div ref={thumbnailRailRef} className="flex w-full max-w-full gap-3 overflow-x-auto pb-1 no-scrollbar">
              {images.map((thumbnail, index) => (
                <button
                  key={`${thumbnail}-${index}`}
                  type="button"
                  data-thumb-index={index}
                  onClick={() => goTo(index)}
                  className={`relative aspect-square h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border bg-white sm:h-24 sm:w-24 ${
                    activeIndex === index ? "border-blue" : "border-gray-3"
                  }`}
                  aria-label={`Show image ${index + 1}`}
                >
                  <SafeProductImage
                    src={resolveProductImageSrc(thumbnail)}
                    alt={`${title} — thumbnail ${index + 1} | i-robox`}
                    fill
                    sizes="(max-width: 1024px) 33vw, 16vw"
                    className="object-contain p-2"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollThumbnails("right")}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-3 bg-white text-dark shadow-sm transition hover:bg-gray-1 sm:inline-flex"
            aria-label="Scroll thumbnails right"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3.5L10.5 8L6 12.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div ref={thumbnailRailRef} className="flex w-full max-w-full gap-3 overflow-x-auto pb-1 no-scrollbar">
          {images.map((thumbnail, index) => (
            <button
              key={`${thumbnail}-${index}`}
              type="button"
              data-thumb-index={index}
              onClick={() => goTo(index)}
              className={`relative aspect-square h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border bg-white sm:h-24 sm:w-24 ${
                activeIndex === index ? "border-blue" : "border-gray-3"
              }`}
              aria-label={`Show image ${index + 1}`}
            >
              <SafeProductImage
                src={resolveProductImageSrc(thumbnail)}
                alt={`${title} — thumbnail ${index + 1} | i-robox`}
                fill
                sizes="(max-width: 1024px) 33vw, 16vw"
                className="object-contain p-2"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

