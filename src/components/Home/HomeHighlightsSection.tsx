import HomeHighlightsRail from "./HomeHighlightsRail";
import type { HighlightCardItem } from "./shared/HighlightCard";

export default function HomeHighlightsSection({
  items,
  sectionEyebrow,
  sectionHeading,
}: {
  items: HighlightCardItem[] | null;
  sectionEyebrow?: string;
  sectionHeading?: string;
}) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-meta-3 py-4">
        No active homepage highlights — add some under Admin → Marketing.
      </p>
    );
  }

  return (
    <>
      <div className="mb-8">
        {sectionEyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue">
            {sectionEyebrow}
          </p>
        ) : null}
        {sectionHeading ? (
          <h2 className="text-2xl font-bold text-dark md:text-[1.75rem]">{sectionHeading}</h2>
        ) : null}
      </div>

      <HomeHighlightsRail items={items} />
    </>
  );
}
