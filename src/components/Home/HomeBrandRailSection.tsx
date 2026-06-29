import type { HomeBrandRailItem } from "./index";
import HomeBrandRail from "./HomeBrandRail";
import HomeSectionHeader from "./shared/HomeSectionHeader";
import { HOME_SECTION_INNER } from "./shared/homeRailStyles";

type HomeBrandRailSectionProps = {
  items: HomeBrandRailItem[] | null;
};

export default function HomeBrandRailSection({ items }: HomeBrandRailSectionProps) {
  const list = items ?? [];

  return (
    <section className="overflow-visible bg-gray-50 pt-4 pb-4 md:pt-6 md:pb-4">
      <div className={HOME_SECTION_INNER}>
        <HomeSectionHeader title="Top Brands" viewAllHref="/shop" />

        {list.length > 0 ? (
          <HomeBrandRail items={list} />
        ) : (
          <p className="text-sm text-meta-3">
            No brand tiles yet — add them under Admin → Marketing → Shop by brand.
          </p>
        )}
      </div>
    </section>
  );
}
