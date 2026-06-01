import Image from "next/image";
import Link from "next/link";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import type { HomeCategoryTile } from "./index";
import { ScrollRailNext, ScrollRailPrev } from "./shared/ScrollRailButtons";

const RAIL_ID = "home-category-rail";

const TILE_CLASS =
  "flex flex-col h-full min-w-[200px] sm:min-w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl bg-gray-1 border border-gray-3 hover:border-blue/40 hover:shadow-sm transition";

type HomeCategoryTilesSectionProps = {
  categories: HomeCategoryTile[] | null;
};

export default function HomeCategoryTilesSection({ categories }: HomeCategoryTilesSectionProps) {
  const items = categories ?? [];
  const hasItems = items.length > 0;
  const showArrows = hasItems && items.length > 1;

  return (
    <section className="py-14 bg-white">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
              Categories
            </p>
            <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
              Discover by category.
            </h2>
          </div>
          <p className="text-xs text-meta-4 sm:text-sm md:hidden">
            Scroll sideways on mobile to see more categories.
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {showArrows ? <ScrollRailPrev scrollId={RAIL_ID} label="Scroll categories left" /> : null}

          <div
            id={RAIL_ID}
            className="min-w-0 flex-1 flex gap-4 px-1 pb-2 overflow-x-auto sm:px-0 sm:gap-5 no-scrollbar scroll-smooth snap-x snap-mandatory"
          >
            {hasItems ? (
              items.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                  prefetch={false}
                  className={TILE_CLASS}
                >
                  {cat.image ? (
                    <div className="relative aspect-[5/3] w-full shrink-0 bg-gray-2">
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        fill
                        sizes="(max-width: 640px) 200px, 240px"
                        className="object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col flex-1 justify-between px-4 py-4">
                    <h3 className="text-sm font-semibold text-dark sm:text-base">{cat.name}</h3>
                    <p className="mt-2 text-[11px] text-meta-3">View products in this category.</p>
                  </div>
                </Link>
              ))
            ) : (
              Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={`${TILE_CLASS} justify-between px-4 py-5`}
                >
                  <h3 className="text-sm font-semibold text-dark sm:text-base">
                    Category placeholder {index + 1}
                  </h3>
                  <p className="mt-2 text-[11px] text-meta-3">
                    Add categories in admin to populate this row.
                  </p>
                </div>
              ))
            )}
          </div>

          {showArrows ? <ScrollRailNext scrollId={RAIL_ID} label="Scroll categories right" /> : null}
        </div>
      </div>
    </section>
  );
}
