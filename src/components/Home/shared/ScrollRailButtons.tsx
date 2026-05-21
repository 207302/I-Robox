"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";

const ARROW_BTN =
  "shrink-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue";

type Props = {
  scrollId: string;
  direction: "prev" | "next";
  className?: string;
  label?: string;
};

function scrollRail(scrollId: string, direction: -1 | 1) {
  const el = document.getElementById(scrollId);
  if (!el) return;
  const step = Math.max(320, Math.floor(el.clientWidth * 0.9));
  el.scrollBy({ left: direction * step, behavior: "smooth" });
}

export function ScrollRailPrev({
  scrollId,
  className = "max-md:hidden",
  label = "Scroll left",
}: Omit<Props, "direction">) {
  return (
    <button
      type="button"
      onClick={() => scrollRail(scrollId, -1)}
      className={`${ARROW_BTN} ${className}`}
      aria-label={label}
    >
      <ChevronLeftIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
    </button>
  );
}

export function ScrollRailNext({
  scrollId,
  className = "max-md:hidden",
  label = "Scroll right",
}: Omit<Props, "direction">) {
  return (
    <button
      type="button"
      onClick={() => scrollRail(scrollId, 1)}
      className={`${ARROW_BTN} ${className}`}
      aria-label={label}
    >
      <ChevronRightIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
    </button>
  );
}
