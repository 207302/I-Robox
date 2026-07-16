"use client";

import { usePreviewSlider } from "@/app/context/PreviewSliderContext";
import { FullScreenIcon } from "@/assets/icons";
import HomeProductWishlistButton from "@/components/Home/shared/HomeProductWishlistButton";
import SafeProductImage from "@/components/Common/SafeProductImage";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";
import { productImageAlt } from "@/lib/seo/metadata";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";

const SWIPE_THRESHOLD = 40;
const AUTO_ADVANCE_MS = 4500;
const SLIDE_MS = 600;

function scrollThumbnailIntoRail(rail: HTMLDivElement, thumb: HTMLElement) {
  const targetTop = thumb.offsetTop - (rail.clientHeight - thumb.offsetHeight) / 2;
  const maxScroll = Math.max(0, rail.scrollHeight - rail.clientHeight);
  rail.scrollTo({
    top: Math.max(0, Math.min(targetTop, maxScroll)),
    behavior: "smooth",
  });
}

type WishlistProps = {
  productId: string;
  slug: string;
  title: string;
  image: string;
  price: number;
};

type Props = {
  title: string;
  images: string[];
  galleryId?: string;
  wishlist?: WishlistProps;
};

export default function DemoProductGallery({
  title,
  images,
  galleryId = "default",
  wishlist,
}: Props) {
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
      if (idx >= 0) goTo(idx);
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
      className="flex w-full flex-row gap-2 md:gap-3"
      onPointerEnter={() => {
        autoplayPausedRef.current = true;
      }}
      onPointerLeave={() => {
        autoplayPausedRef.current = false;
      }}
    >
      {images.length > 1 ? (
        <div
          ref={thumbnailRailRef}
          className="flex max-h-[300px] w-12 shrink-0 flex-col gap-1.5 overflow-y-auto no-scrollbar md:max-h-[420px] md:w-[72px] md:gap-2"
        >
          {images.map((thumbnail, index) => (
            <button
              key={`${thumbnail}-${index}`}
              type="button"
              data-thumb-index={index}
              onClick={() => goTo(index)}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-white object-contain transition md:h-[72px] md:w-[72px] md:rounded-lg ${
                activeIndex === index
                  ? "border-blue shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              aria-label={`Show image ${index + 1}`}
            >
              <SafeProductImage
                src={resolveProductImageSrc(thumbnail)}
                alt={`${title} — thumbnail ${index + 1} | i-robox`}
                fill
                sizes="(max-width: 767px) 48px, 72px"
                className="object-contain p-1 md:p-1.5"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-gray-50 touch-pan-y h-[300px] md:h-[420px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {wishlist ? (
          <HomeProductWishlistButton
            productId={wishlist.productId}
            slug={wishlist.slug}
            title={wishlist.title}
            image={wishlist.image}
            price={wishlist.price}
          />
        ) : null}

        <button
          type="button"
          onClick={() => openLightbox(activeIndex)}
          className="absolute left-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white/95 text-dark shadow-sm transition hover:bg-white"
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
              className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-dark shadow-sm transition hover:bg-white md:inline-flex"
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
              className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-dark shadow-sm transition hover:bg-white md:inline-flex"
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
                    alt={
                      index === 0
                        ? productImageAlt(title)
                        : `${title} — view ${index + 1} | i-robox`
                    }
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain p-4"
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
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain p-4"
            priority
            fetchPriority="high"
          />
        ) : null}
      </div>
    </div>
  );
}
