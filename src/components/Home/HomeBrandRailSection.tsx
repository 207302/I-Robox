"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeBrandRailItem } from "./index";

type HomeBrandRailSectionProps = {
  items: HomeBrandRailItem[] | null;
};

const ARROW_BTN =
  "shrink-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-default disabled:opacity-50";

export default function HomeBrandRailSection({ items }: HomeBrandRailSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [items, updateScrollState]);

  const scrollPage = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(320, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  const hasItems = items && items.length > 0;
  const showArrows = hasItems && items.length > 1;

  return (
    <section className="py-14 bg-gray-1 border-y border-gray-3">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
              Shop by brand
            </p>
            <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
              Browse by maker or universe.
            </h2>
            <p className="mt-1 text-sm text-meta-3">
              Tiles and images are managed in Admin → Marketing → Shop by brand.
            </p>
          </div>
          <p className="text-xs text-meta-4 sm:text-sm md:hidden">
            Scroll sideways on mobile to see more brands.
          </p>
          <p className="hidden text-xs text-meta-4 md:block">
            Use the arrows to see more brands.
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {showArrows ? (
            <button
              type="button"
              onClick={() => scrollPage(-1)}
              disabled={!canScrollLeft}
              className={`${ARROW_BTN} max-md:hidden`}
              aria-label="Scroll brands left"
            >
              <ChevronLeftIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
            </button>
          ) : null}

          <div
            ref={scrollRef}
            className="min-w-0 flex-1 flex gap-4 px-1 pb-2 overflow-x-auto sm:px-0 sm:gap-5 no-scrollbar scroll-smooth"
          >
            {hasItems ? (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="min-w-[200px] sm:min-w-[240px] flex flex-col shrink-0 text-left"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 640px) 200px, 240px"
                      className="object-cover rounded-2xl"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 w-full rounded-xl bg-white border border-gray-3 px-3 py-2 shadow-sm flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-semibold text-dark text-center">
                      {item.label}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-meta-3 py-4">
                No brand tiles yet — add them under Admin → Marketing → Shop by brand.
              </p>
            )}
          </div>

          {showArrows ? (
            <button
              type="button"
              onClick={() => scrollPage(1)}
              disabled={!canScrollRight}
              className={`${ARROW_BTN} max-md:hidden`}
              aria-label="Scroll brands right"
            >
              <ChevronRightIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
