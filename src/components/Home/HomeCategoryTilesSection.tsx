import type { HomeCategoryTile } from "./index";
import HomeCategoryTilesRail from "./HomeCategoryTilesRail";
import HomeSectionHeader from "./shared/HomeSectionHeader";
import { HOME_SECTION_INNER, HOME_SECTION_SHELL } from "./shared/homeRailStyles";

type HomeCategoryTilesSectionProps = {
  categories: HomeCategoryTile[] | null;
};

export default function HomeCategoryTilesSection({ categories }: HomeCategoryTilesSectionProps) {
  const items = categories ?? [];

  return (
    <section className={HOME_SECTION_SHELL}>
      <div className={HOME_SECTION_INNER}>
        <HomeSectionHeader title="Shop by Category" viewAllHref="/shop" />

        {items.length > 0 ? (
          <HomeCategoryTilesRail items={items} />
        ) : (
          <p className="text-sm text-meta-3">
            Add category tiles under Admin → Marketing → Discover by category.
          </p>
        )}
      </div>
    </section>
  );
}
