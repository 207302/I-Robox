"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import HighlightCard, { type HighlightCardItem } from "./shared/HighlightCard";
import {
  HOME_HIGHLIGHTS_CARD_WIDTH,
  HOME_RAIL_ARROW_BTN,
  HOME_RAIL_OUTER,
  HOME_RAIL_SCROLL,
} from "./shared/homeRailStyles";

const RAIL_ID = "home-highlights-rail";

type HomeHighlightsRailProps = {
  items: HighlightCardItem[];
};

export default function HomeHighlightsRail({ items }: HomeHighlightsRailProps) {
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
        aria-label="Scroll highlights left"
        disabled={atStart}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>

      <div id={RAIL_ID} className={HOME_RAIL_SCROLL}>
        {items.map((item) => (
          <div key={item.id} className={`${HOME_HIGHLIGHTS_CARD_WIDTH} snap-start`}>
            <HighlightCard item={item} />
          </div>
        ))}
      </div>

      <button
        type="button"
        className={HOME_RAIL_ARROW_BTN}
        aria-label="Scroll highlights right"
        disabled={atEnd}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
