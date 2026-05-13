"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type TouchEvent,
} from "react";

export type HighlightItem = {
  id: string;
  href: string;
  image: string;
  label: string;
  alt: string;
  subtitle?: string | null;
};

const AUTO_ADVANCE_MS = 2800;
const SWIPE_THRESHOLD = 50;
/** Tailwind gap-6 */
const DESKTOP_GAP_PX = 24;

const cardHoverClass =
  "md:hover:-translate-y-1 md:hover:shadow-xl md:hover:ring-2 md:hover:ring-red/40";

function HighlightCard({ item, imagePriority }: { item: HighlightItem; imagePriority?: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group relative block h-full overflow-hidden rounded-2xl border border-gray-3 bg-white shadow-md shadow-black/10 transition-[transform,box-shadow,border-color,ring-color] duration-300 active:scale-[0.98] active:translate-y-0 text-left ${cardHoverClass}`}
    >
      <div className="relative aspect-[4/3] w-full md:aspect-[5/4]">
        <Image
          src={item.image}
          alt={item.alt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
          priority={imagePriority}
          fetchPriority={imagePriority ? "high" : undefined}
          loading={imagePriority ? undefined : "lazy"}
        />
        <div className="absolute inset-x-3 bottom-3 rounded-lg bg-red/90 px-3 py-2 shadow-md shadow-red/30 transition-[background-color,box-shadow] duration-300 group-hover:bg-red group-hover:shadow-lg group-hover:shadow-red/40">
          <p className="text-sm font-bold text-white tracking-wide">{item.label}</p>
          {item.subtitle ? (
            <p className="mt-0.5 text-[11px] font-medium text-white/90 line-clamp-2">
              {item.subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function MobileHighlightsCarousel({ items }: { items: HighlightItem[] }) {
  const n = items.length;
  const slidesKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goNext = useCallback(() => {
    startTransition(() => {
      setActiveIndex((p) => (n > 0 ? (p + 1) % n : 0));
    });
  }, [n]);

  const goPrev = useCallback(() => {
    startTransition(() => {
      setActiveIndex((p) => (n > 0 ? (p - 1 + n) % n : 0));
    });
  }, [n]);

  useEffect(() => {
    startTransition(() => setActiveIndex(0));
  }, [slidesKey]);

  useEffect(() => {
    if (n <= 1) return undefined;
    const timer = window.setInterval(goNext, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [goNext, n]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const touchEndX = event.changedTouches[0]?.clientX;
    if (typeof touchEndX !== "number") return;
    const deltaX = touchEndX - touchStartX.current;
    touchStartX.current = null;
    if (n < 2) return;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) goNext();
    else goPrev();
  };

  const slideFraction = 100 / n;

  return (
    <div
      className="relative w-full touch-pan-y"
      aria-roledescription="carousel"
      aria-label="Highlights"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(-${activeIndex * slideFraction}%)`,
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative h-full shrink-0"
              style={{ width: `${slideFraction}%` }}
            >
              <HighlightCard item={item} imagePriority={index === 0} />
            </div>
          ))}
        </div>
      </div>

      {n > 1 ? (
        <div
          className="mt-4 flex justify-center gap-2"
          role="tablist"
          aria-label="Highlight slides"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Highlight ${index + 1} of ${n}`}
              onClick={() => startTransition(() => setActiveIndex(index))}
              className={`h-2 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                index === activeIndex ? "w-8 bg-red" : "w-2 bg-gray-3 hover:bg-gray-4"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Desktop: exactly three cards visible; window shifts by one card when n > 3. */
function DesktopThreeCarousel({ items }: { items: HighlightItem[] }) {
  const n = items.length;
  const positions = n - 2;
  const slidesKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const [pos, setPos] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [stepPx, setStepPx] = useState(0);

  const goNext = useCallback(() => {
    startTransition(() => {
      setPos((p) => (positions > 0 ? (p + 1) % positions : 0));
    });
  }, [positions]);

  const goPrev = useCallback(() => {
    startTransition(() => {
      setPos((p) => (positions > 0 ? (p - 1 + positions) % positions : 0));
    });
  }, [positions]);

  useEffect(() => {
    startTransition(() => setPos(0));
  }, [slidesKey]);

  useEffect(() => {
    if (positions <= 1) return undefined;
    const timer = window.setInterval(goNext, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [goNext, positions]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const cardW = (w - 2 * DESKTOP_GAP_PX) / 3;
      setStepPx(cardW + DESKTOP_GAP_PX);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n, slidesKey]);

  const cardWidthPx =
    stepPx > 0 ? stepPx - DESKTOP_GAP_PX : undefined;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          goPrev();
        }}
        className="absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue md:-left-1 lg:left-0"
        aria-label="Previous highlights"
      >
        <ChevronLeftIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          goNext();
        }}
        className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue md:-right-1 lg:right-0"
        aria-label="Next highlights"
      >
        <ChevronRightIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
      </button>

      <div
        ref={viewportRef}
        className="min-h-[200px] overflow-hidden md:mx-11 lg:mx-12 md:min-h-[240px]"
        style={{ visibility: stepPx > 0 ? "visible" : "hidden" }}
      >
        <div
          className="flex gap-6 transition-transform duration-500 ease-out"
          style={{
            transform: stepPx > 0 ? `translateX(-${pos * stepPx}px)` : undefined,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="shrink-0"
              style={
                cardWidthPx !== undefined
                  ? { width: cardWidthPx, minWidth: cardWidthPx }
                  : undefined
              }
            >
              <HighlightCard item={item} imagePriority={item.id === items[0].id} />
            </div>
          ))}
        </div>
      </div>

      {positions > 1 ? (
        <div
          className="mt-4 flex justify-center gap-2"
          role="tablist"
          aria-label="Highlight window"
        >
          {Array.from({ length: positions }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === pos}
              aria-label={`Highlights ${index + 1} of ${positions}`}
              onClick={() => startTransition(() => setPos(index))}
              className={`h-2 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                index === pos ? "w-8 bg-red" : "w-2 bg-gray-3 hover:bg-gray-4"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function HomeHighlightsSection({ items }: { items: HighlightItem[] | null }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-meta-3 md:col-span-3 text-center py-6">
        No active homepage highlights — add some under Admin → Marketing.
      </p>
    );
  }

  const n = items.length;

  return (
    <>
      <div className="md:hidden">
        <MobileHighlightsCarousel items={items} />
      </div>

      <div className="hidden md:block">
        {n <= 3 ? (
          <div className="grid grid-cols-3 gap-6">
            {items.map((item, index) => (
              <HighlightCard key={item.id} item={item} imagePriority={index === 0} />
            ))}
          </div>
        ) : (
          <DesktopThreeCarousel items={items} />
        )}
      </div>
    </>
  );
}
