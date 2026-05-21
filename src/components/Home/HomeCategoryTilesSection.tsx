"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeCategoryTile } from "./index";

type HomeCategoryTilesSectionProps = {
  categories: HomeCategoryTile[] | null;
};

const ARROW_BTN =
  "shrink-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-default disabled:opacity-50";

const TILE_CLASS =
  "flex flex-col h-full min-w-[200px] sm:min-w-[240px] shrink-0 overflow-hidden rounded-2xl bg-gray-1 border border-gray-3 hover:border-blue/40 hover:shadow-sm transition";

export default function HomeCategoryTilesSection({ categories }: HomeCategoryTilesSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const items = categories ?? [];
  const hasItems = items.length > 0;
  const showArrows = hasItems && items.length > 1;

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

  return (
    <section className="py-14 bg-white">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
              Categories
            </p>
            <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
              Discover by category.
            </h2>
            <p className="mt-1 text-sm text-meta-3">
              Choose categories, order, and photos in Admin → Marketing → Discover by category. If none
              are configured, the first eight catalog categories show here without images.
            </p>
          </div>
          <p className="text-xs text-meta-4 sm:text-sm md:hidden">
            Scroll sideways on mobile to see more categories.
          </p>
          <p className="hidden text-xs text-meta-4 md:block">
            Use the arrows to see more categories.
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {showArrows ? (
            <button
              type="button"
              onClick={() => scrollPage(-1)}
              disabled={!canScrollLeft}
              className={`${ARROW_BTN} max-md:hidden`}
              aria-label="Scroll categories left"
            >
              <ChevronLeftIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
            </button>
          ) : null}

          <div
            ref={scrollRef}
            className="min-w-0 flex-1 flex gap-4 px-1 pb-2 overflow-x-auto sm:px-0 sm:gap-5 no-scrollbar scroll-smooth snap-x snap-mandatory"
          >
            {hasItems ? (
              items.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                  className={`${TILE_CLASS} snap-start`}
                >
                  {cat.image ? (
                    <div className="relative aspect-[5/3] w-full shrink-0 bg-gray-2">
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        fill
                        sizes="(max-width: 640px) 200px, 240px"
                        className="object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col flex-1 justify-between px-4 py-4">
                    <h3 className="text-sm font-semibold text-dark sm:text-base">{cat.name}</h3>
                    <p className="mt-2 text-[11px] text-meta-3">View products in this category.</p>
                  </div>
                </Link>
              ))
            ) : (
              Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={`${TILE_CLASS} snap-start justify-between px-4 py-5`}
                >
                  <h3 className="text-sm font-semibold text-dark sm:text-base">
                    Category placeholder {index + 1}
                  </h3>
                  <p className="mt-2 text-[11px] text-meta-3">
                    Add categories in admin to populate this row.
                  </p>
                </div>
              ))
            )}
          </div>

          {showArrows ? (
            <button
              type="button"
              onClick={() => scrollPage(1)}
              disabled={!canScrollRight}
              className={`${ARROW_BTN} max-md:hidden`}
              aria-label="Scroll categories right"
            >
              <ChevronRightIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
