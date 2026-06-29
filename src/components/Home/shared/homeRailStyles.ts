/** Shared layout + styling for homepage horizontal rails (categories, new arrivals). */

export const HOME_SECTION_INNER =
  "mx-auto w-full max-w-screen-2xl overflow-visible px-4 sm:px-6 lg:px-8 xl:px-10";

export const HOME_SECTION_SHELL = "overflow-visible bg-white py-12 md:py-14";

export const HOME_RAIL_CARD_SHADOW =
  "shadow-[0_6px_16px_-2px_rgba(0,0,0,0.12),0_3px_6px_-1px_rgba(0,0,0,0.08)]";

export const HOME_RAIL_CARD_SHADOW_HOVER =
  "hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.18),0_8px_16px_-4px_rgba(0,0,0,0.10)] transition-all duration-300 ease-out";

/** Mobile: 2 visible · Desktop: 5 fill the scroll viewport (gap-5 = 5rem across 4 gaps) */
export const HOME_RAIL_CARD_WIDTH =
  "w-[calc(50%-0.625rem)] shrink-0 md:w-[calc((100%-5rem)/5)] md:min-w-0";

/** Mobile: 1–2 visible · Desktop: 4 fill the scroll viewport (gap-5 = 3.75rem across 3 gaps) */
export const HOME_HIGHLIGHTS_CARD_WIDTH =
  "w-[calc(85%-0.625rem)] shrink-0 sm:w-[calc(50%-0.625rem)] md:w-[calc((100%-3.75rem)/4)] md:min-w-0";

export const HOME_HIGHLIGHTS_IMAGE_SIZES = "(max-width: 768px) 85vw, 22vw";

export const HOME_RAIL_SCROLL =
  "flex w-full min-w-0 flex-1 items-stretch gap-5 overflow-x-auto overscroll-x-contain px-3 py-5 no-scrollbar scroll-smooth snap-x snap-mandatory";

export const HOME_RAIL_ARROW_BTN =
  "hidden shrink-0 md:flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-dark shadow-md transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30";

export const HOME_RAIL_IMAGE_HEIGHT = "h-52 md:h-56";

export const HOME_RAIL_IMAGE_SIZES = "(max-width: 768px) 46vw, 18vw";

export const HOME_RAIL_CATEGORY_LABEL_HEIGHT = "h-[4.5rem]";

export const HOME_RAIL_PRODUCT_TEXT_HEIGHT = "h-24";

export const HOME_RAIL_OUTER = "flex items-center gap-3 md:gap-4";
