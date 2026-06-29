"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import HomeProductCard, { type HomeProductCardItem } from "./HomeProductCard";
import { HOME_RAIL_ARROW_BTN, HOME_RAIL_OUTER, HOME_RAIL_SCROLL } from "./homeRailStyles";

type Props = {
  items: HomeProductCardItem[];
  railId: string;
  showNewBadge?: boolean;
  showSaleBadge?: boolean;
  emptyMessage?: string;
};

export default function HomeProductRail({
  items,
  railId,
  showNewBadge = false,
  showSaleBadge = false,
  emptyMessage = "No products to show yet.",
}: Props) {
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = document.getElementById(railId);
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(maxScroll <= 4 || el.scrollLeft >= maxScroll - 4);
  }, [railId]);

  useEffect(() => {
    updateEdges();
    const el = document.getElementById(railId);
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [railId, items.length, updateEdges]);

  function scrollBy(direction: -1 | 1) {
    const el = document.getElementById(railId);
    if (!el) return;
    const step = Math.max(200, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  if (items.length === 0) {
    return <p className="text-sm text-meta-3 py-4">{emptyMessage}</p>;
  }

  return (
    <div className={HOME_RAIL_OUTER}>
      <button
        type="button"
        className={HOME_RAIL_ARROW_BTN}
        aria-label="Scroll products left"
        disabled={atStart}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>

      <div id={railId} className={HOME_RAIL_SCROLL}>
        {items.map((item, index) => (
          <HomeProductCard
            key={item.id}
            item={item}
            priority={index < 2}
            showNewBadge={showNewBadge}
            showSaleBadge={showSaleBadge}
          />
        ))}
      </div>

      <button
        type="button"
        className={HOME_RAIL_ARROW_BTN}
        aria-label="Scroll products right"
        disabled={atEnd}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
