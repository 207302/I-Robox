"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import type { HomeCategoryTile } from "./index";
import {
  HOME_RAIL_ARROW_BTN,
  HOME_RAIL_CARD_SHADOW,
  HOME_RAIL_CARD_SHADOW_HOVER,
  HOME_RAIL_CARD_WIDTH,
  HOME_RAIL_CATEGORY_LABEL_HEIGHT,
  HOME_RAIL_IMAGE_HEIGHT,
  HOME_RAIL_IMAGE_SIZES,
  HOME_RAIL_OUTER,
  HOME_RAIL_SCROLL,
} from "./shared/homeRailStyles";

const RAIL_ID = "home-category-rail";

type HomeCategoryTilesRailProps = {
  items: HomeCategoryTile[];
};

export default function HomeCategoryTilesRail({ items }: HomeCategoryTilesRailProps) {
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = document.getElementById(RAIL_ID);
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(maxScroll <= 4 || el.scrollLeft >= maxScroll - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = document.getElementById(RAIL_ID);
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [items.length, updateEdges]);

  function scrollBy(direction: -1 | 1) {
    const el = document.getElementById(RAIL_ID);
    if (!el) return;
    const step = Math.max(200, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div className={HOME_RAIL_OUTER}>
      <button
        type="button"
        className={HOME_RAIL_ARROW_BTN}
        aria-label="Scroll categories left"
        disabled={atStart}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>

      <div
        id={RAIL_ID}
        className={HOME_RAIL_SCROLL}
        aria-label="Shop by category"
      >
        {items.map((cat) => (
          <div
            key={cat.id}
            className={`${HOME_RAIL_CARD_WIDTH} snap-start ${HOME_RAIL_CARD_SHADOW} ${HOME_RAIL_CARD_SHADOW_HOVER} rounded-2xl`}
          >
            <Link
              href={`/category/${encodeURIComponent(cat.slug)}`}
              prefetch={shouldPrefetchHref(`/category/${encodeURIComponent(cat.slug)}`)}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white"
            >
              <div className={`relative ${HOME_RAIL_IMAGE_HEIGHT} w-full overflow-hidden bg-gray-100`}>
                {cat.image ? (
                  <Image
                    src={cat.image}
                    alt={`${cat.name} collection at i-robox`}
                    fill
                    sizes={HOME_RAIL_IMAGE_SIZES}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-100 text-sm font-semibold text-meta-3">
                    {cat.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className={`flex ${HOME_RAIL_CATEGORY_LABEL_HEIGHT} shrink-0 items-center justify-center px-3`}>
                <p className="line-clamp-3 text-center text-sm font-medium leading-snug text-dark md:text-base">
                  {cat.name}
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={HOME_RAIL_ARROW_BTN}
        aria-label="Scroll categories right"
        disabled={atEnd}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
