import HomeProductCard, { type HomeProductCardItem } from "./shared/HomeProductCard";
import { ScrollRailNext, ScrollRailPrev } from "./shared/ScrollRailButtons";

const ITEMS_PER_SECTION = 8;
const MAX_SECTIONS = 3;
const MOBILE_RAIL_ID = "home-new-arrivals-mobile";
const DESKTOP_RAIL_ID = "home-new-arrivals-desktop";

export default function HomeProductCarouselSection({
  items,
}: {
  items: HomeProductCardItem[] | null;
}) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-meta-3 py-4">No new arrivals yet — add products in Admin.</p>;
  }

  const capped = items.slice(0, ITEMS_PER_SECTION * MAX_SECTIONS);
  const sections = Array.from(
    { length: Math.ceil(capped.length / ITEMS_PER_SECTION) },
    (_, idx) => capped.slice(idx * ITEMS_PER_SECTION, (idx + 1) * ITEMS_PER_SECTION)
  );
  const showDesktopArrows = sections.length > 1;

  return (
    <>
      <div className="md:hidden">
        <div
          id={MOBILE_RAIL_ID}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        >
          {sections.map((section, idx) => (
            <div key={idx} className="w-full shrink-0 snap-start px-0">
              <div className="grid grid-cols-2 gap-4">
                {section.slice(0, 4).map((item) => (
                  <HomeProductCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="relative flex items-center gap-2 md:gap-3">
          {showDesktopArrows ? (
            <ScrollRailPrev scrollId={DESKTOP_RAIL_ID} label="Previous new arrivals section" />
          ) : null}
          <div
            id={DESKTOP_RAIL_ID}
            className="min-w-0 flex-1 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
          >
            <div className="flex">
              {sections.map((section, idx) => (
                <div key={idx} className="w-full shrink-0 snap-start">
                  <div className="grid grid-cols-4 gap-4">
                    {section.map((item) => (
                      <HomeProductCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {showDesktopArrows ? (
            <ScrollRailNext scrollId={DESKTOP_RAIL_ID} label="Next new arrivals section" />
          ) : null}
        </div>
      </div>
    </>
  );
}
