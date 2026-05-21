import HighlightCard, { type HighlightCardItem } from "./shared/HighlightCard";
import { ScrollRailNext, ScrollRailPrev } from "./shared/ScrollRailButtons";

const RAIL_ID = "home-highlights-rail";

export default function HomeHighlightsSection({
  items,
}: {
  items: HighlightCardItem[] | null;
}) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-meta-3 md:col-span-3 text-center py-6">
        No active homepage highlights — add some under Admin → Marketing.
      </p>
    );
  }

  if (items.length <= 3) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {items.map((item) => (
          <HighlightCard key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 md:gap-3">
      <ScrollRailPrev scrollId={RAIL_ID} label="Scroll highlights left" />
      <div
        id={RAIL_ID}
        className="home-highlights-rail min-w-0 flex-1 flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth snap-x snap-mandatory md:gap-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[min(100%,340px)] shrink-0 snap-start sm:w-[300px] md:w-[calc((100%-3rem)/3)]"
          >
            <HighlightCard item={item} />
          </div>
        ))}
      </div>
      <ScrollRailNext scrollId={RAIL_ID} label="Scroll highlights right" />
    </div>
  );
}
