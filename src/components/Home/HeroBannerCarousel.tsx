"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type TouchEvent,
} from "react";
import { heroOverlayTextStyle } from "@/lib/marketing/heroOverlayColors";

export type HeroSlide = {
  id: string;
  image_url: string;
  title?: string | null;
  link_url?: string | null;
};

const AUTO_ROTATE_INTERVAL = 7000;
const SWIPE_THRESHOLD = 50;

type Props = {
  slides?: HeroSlide[];
  overlay?: {
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
};

const HeroBannerCarousel = ({ slides: slidesProp, overlay }: Props) => {
  const slides = slidesProp && slidesProp.length > 0 ? slidesProp : [];
  const overlayCopy = {
    eyebrow: overlay?.eyebrow?.trim() ?? "",
    heading: overlay?.heading?.trim() ?? "",
    subheading: overlay?.subheading?.trim() ?? "",
    ctaLabel: overlay?.ctaLabel?.trim() ?? "",
    ctaHref: overlay?.ctaHref?.trim() ?? "",
  };
  const hasOverlayCopy =
    Boolean(overlayCopy.eyebrow) ||
    Boolean(overlayCopy.heading) ||
    Boolean(overlayCopy.subheading);
  const showCta = Boolean(overlayCopy.ctaLabel && overlayCopy.ctaHref);
  const eyebrowStyle = heroOverlayTextStyle(overlay?.eyebrowColor);
  const headingStyle = heroOverlayTextStyle(overlay?.headingColor);
  const subheadingStyle = heroOverlayTextStyle(overlay?.subheadingColor);
  const ctaLabelStyle = heroOverlayTextStyle(overlay?.ctaLabelColor);
  const slidesKey = useMemo(() => slides.map((s) => s.id).join("|"), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const controlsHideTimerRef = useRef<number | null>(null);
  const [mobileControlsActive, setMobileControlsActive] = useState(false);

  const goToNext = useCallback(() => {
    startTransition(() => {
      setActiveIndex((prev) =>
        slides.length > 0 ? (prev + 1) % slides.length : 0
      );
    });
  }, [slides.length]);

  const goToPrev = useCallback(() => {
    startTransition(() => {
      setActiveIndex((prev) =>
        slides.length > 0 ? (prev - 1 + slides.length) % slides.length : 0
      );
    });
  }, [slides.length]);

  const showMobileControlsTemporarily = useCallback(() => {
    setMobileControlsActive(true);
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
    }
    controlsHideTimerRef.current = window.setTimeout(() => {
      setMobileControlsActive(false);
      controlsHideTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    startTransition(() => setActiveIndex(0));
  }, [slidesKey]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      goToNext();
    }, AUTO_ROTATE_INTERVAL);
    return () => window.clearInterval(timer);
  }, [goToNext, slides.length]);

  useEffect(() => {
    return () => {
      if (controlsHideTimerRef.current) window.clearTimeout(controlsHideTimerRef.current);
    };
  }, []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    showMobileControlsTemporarily();
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;

    const touchEndX = event.changedTouches[0]?.clientX;
    if (typeof touchEndX !== "number") return;

    const deltaX = touchEndX - touchStartX.current;
    touchStartX.current = null;

    if (slides.length < 2) return;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) goToNext();
    else goToPrev();
  };

  if (slides.length === 0) {
    return (
      <div
        className="relative flex w-full aspect-[3/2] lg:aspect-[2.7/1] items-center justify-center bg-gray-1 border-b border-gray-3"
        aria-label="Hero banner area"
      >
        <p className="max-w-md px-4 text-center text-sm leading-relaxed text-meta-3">
          No hero banners yet. Add slides under{" "}
          <span className="font-medium text-dark">Admin → Marketing → Hero</span>.
        </p>
      </div>
    );
  }

  const slideFraction = 100 / slides.length;
  const showArrows = slides.length > 1;

  return (
    <div
      className="relative w-full touch-pan-y aspect-[3/2] lg:aspect-[2.7/1]"
      aria-roledescription="carousel"
      aria-label="Hero banner carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translateX(-${activeIndex * slideFraction}%)`,
          }}
        >
          {slides.map((banner, index) => (
            <div
              key={banner.id}
              className="relative h-full shrink-0"
              style={{ width: `${slideFraction}%` }}
            >
              {banner.link_url ? (
                <Link href={banner.link_url} className="relative block h-full w-full">
                  <Image
                    src={banner.image_url}
                    alt={banner.title ?? "Hero banner"}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </Link>
              ) : (
                <Image
                  src={banner.image_url}
                  alt={banner.title ?? "Hero banner"}
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Static overlay copy: stays fixed while slides move underneath */}
      {hasOverlayCopy || showCta ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[15] w-[88%] bg-gradient-to-r from-black/80 via-black/45 to-transparent sm:w-[70%] lg:w-[52%]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[16] flex w-full items-center">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 xl:px-0">
              <div className="max-w-xl text-white">
            {overlayCopy.eyebrow ? (
              <p
                style={eyebrowStyle}
                className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs ${eyebrowStyle ? "" : "text-white/90"}`}
              >
                {overlayCopy.eyebrow}
              </p>
            ) : null}
            {overlayCopy.heading ? (
              <h1
                style={headingStyle}
                className={`text-2xl font-semibold leading-[1.08] drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)] sm:text-4xl sm:font-extrabold sm:drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] lg:text-6xl ${headingStyle ? "" : "text-white/95"}`}
              >
                {overlayCopy.heading}
              </h1>
            ) : null}
            {overlayCopy.subheading ? (
              <p
                style={subheadingStyle}
                className={`mt-3 max-w-lg text-sm leading-relaxed sm:text-base lg:text-lg ${subheadingStyle ? "" : "text-white/80 sm:text-white/90"}`}
              >
                {overlayCopy.subheading}
              </p>
            ) : null}
            {showCta ? (
              <div className="pointer-events-auto mt-5">
                <Link
                  href={overlayCopy.ctaHref}
                  style={ctaLabelStyle}
                  className={`inline-flex items-center rounded-lg bg-red px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/25 transition hover:bg-red-dark sm:px-6 sm:py-3 sm:text-base ${ctaLabelStyle ? "" : "text-white"}`}
                >
                  {overlayCopy.ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
        </>
      ) : null}

      {showArrows ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              goToPrev();
            }}
            className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 text-white transition-opacity duration-200 ${
              mobileControlsActive ? "opacity-95" : "opacity-30"
            } sm:left-4 sm:flex sm:h-11 sm:w-11 sm:items-center sm:justify-center sm:rounded-full sm:border-2 sm:border-white/90 sm:bg-dark sm:opacity-100 sm:shadow-lg sm:shadow-dark/40 sm:hover:bg-blue`}
            aria-label="Previous banner"
            onTouchStart={() => showMobileControlsTemporarily()}
          >
            <ChevronLeftIcon className="size-7 text-white [&_path]:stroke-[2.5] sm:size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              goToNext();
            }}
            className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 text-white transition-opacity duration-200 ${
              mobileControlsActive ? "opacity-95" : "opacity-30"
            } sm:right-4 sm:flex sm:h-11 sm:w-11 sm:items-center sm:justify-center sm:rounded-full sm:border-2 sm:border-white/90 sm:bg-dark sm:opacity-100 sm:shadow-lg sm:shadow-dark/40 sm:hover:bg-blue`}
            aria-label="Next banner"
            onTouchStart={() => showMobileControlsTemporarily()}
          >
            <ChevronRightIcon className="size-7 text-white [&_path]:stroke-[2.5] sm:size-6" />
          </button>
        </>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2 sm:bottom-4"
        role="tablist"
        aria-label="Banner slides"
      >
        {slides.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Banner ${index + 1} of ${slides.length}`}
            onClick={(e) => {
              e.preventDefault();
              startTransition(() => setActiveIndex(index));
            }}
            className={`pointer-events-auto h-2.5 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              index === activeIndex
                ? "w-8 bg-white shadow-sm"
                : "w-2.5 bg-white/55 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroBannerCarousel;
