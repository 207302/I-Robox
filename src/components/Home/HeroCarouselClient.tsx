"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type TouchEvent,
} from "react";
import HeroSlideImage from "./HeroSlideImage";
import type { HeroSlide } from "./heroTypes";
import { DEFAULT_HERO_CAROUSEL_INTERVAL_MS } from "@/lib/marketing/heroCarousel";
import { HERO_HEIGHT_CLASS } from "./heroLayout";

const SWIPE_THRESHOLD = 50;

type Props = {
  slides: HeroSlide[];
  autoRotateIntervalMs?: number;
};

/** Horizontal slide track — non-LCP slides use lazy loading via HeroSlideImage. */
export default function HeroCarouselClient({
  slides,
  autoRotateIntervalMs = DEFAULT_HERO_CAROUSEL_INTERVAL_MS,
}: Props) {
  const slideCount = slides.length;
  const slidesKey = useMemo(() => slides.map((s) => s.id).join("|"), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const controlsHideTimerRef = useRef<number | null>(null);
  const [mobileControlsActive, setMobileControlsActive] = useState(false);

  const goToNext = useCallback(() => {
    startTransition(() => {
      setActiveIndex((prev) => (slideCount > 0 ? (prev + 1) % slideCount : 0));
    });
  }, [slideCount]);

  const goToPrev = useCallback(() => {
    startTransition(() => {
      setActiveIndex((prev) =>
        slideCount > 0 ? (prev - 1 + slideCount) % slideCount : 0
      );
    });
  }, [slideCount]);

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
    if (slideCount <= 1 || paused) return undefined;
    const intervalId = window.setInterval(() => {
      goToNext();
    }, autoRotateIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [goToNext, slideCount, autoRotateIntervalMs, paused]);

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
    if (slideCount < 2) return;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) goToNext();
    else goToPrev();
  };

  const showArrows = slideCount > 1;

  return (
    <div
      className={`relative w-full touch-pan-y overflow-hidden ${HERO_HEIGHT_CLASS}`}
      aria-roledescription="carousel"
      aria-label="Hero banner carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 overflow-hidden bg-gray-2">
        <div
          className="flex h-full transition-transform duration-500 ease-out will-change-transform"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={slide.id}
                className={`relative h-full min-w-full flex-shrink-0 ${
                  isActive ? "" : "pointer-events-none"
                }`}
                aria-hidden={!isActive}
              >
                <HeroSlideImage slide={slide} isLcp={index === 0} />
              </div>
            );
          })}
        </div>
      </div>

      {showArrows ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              goToPrev();
            }}
            className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 text-white transition-all duration-200 ${
              mobileControlsActive ? "opacity-95" : "opacity-30"
            } sm:left-4 sm:flex sm:h-11 sm:w-11 sm:items-center sm:justify-center sm:rounded-full sm:border-2 sm:border-white/80 sm:bg-transparent sm:opacity-100 sm:shadow-none sm:hover:bg-white/10`}
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
            className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 text-white transition-all duration-200 ${
              mobileControlsActive ? "opacity-95" : "opacity-30"
            } sm:right-4 sm:flex sm:h-11 sm:w-11 sm:items-center sm:justify-center sm:rounded-full sm:border-2 sm:border-white/80 sm:bg-transparent sm:opacity-100 sm:shadow-none sm:hover:bg-white/10`}
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
        {Array.from({ length: slideCount }, (_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Banner ${index + 1} of ${slideCount}`}
            onClick={(e) => {
              e.preventDefault();
              startTransition(() => setActiveIndex(index));
            }}
            className={`pointer-events-auto h-2.5 rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              index === activeIndex
                ? "w-8 bg-white shadow-sm"
                : "w-2.5 bg-white/55 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
