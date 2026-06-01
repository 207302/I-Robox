import Image from "next/image";
import Link from "next/link";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import type { HomeBrandRailItem } from "./index";
import { ScrollRailNext, ScrollRailPrev } from "./shared/ScrollRailButtons";

const RAIL_ID = "home-brand-rail";

type HomeBrandRailSectionProps = {
  items: HomeBrandRailItem[] | null;
};

export default function HomeBrandRailSection({ items }: HomeBrandRailSectionProps) {
  const hasItems = items && items.length > 0;
  const showArrows = hasItems && items.length > 1;

  return (
    <section className="py-14 bg-gray-1 border-y border-gray-3">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-[0.18em] uppercase text-blue">
              Shop by brand
            </p>
            <h2 className="text-xl font-semibold text-dark xl:text-heading-5">
              Browse by maker or universe.
            </h2>
          </div>
          <p className="text-xs text-meta-4 sm:text-sm md:hidden">
            Scroll sideways on mobile to see more brands.
          </p>
          <p className="hidden text-xs text-meta-4 md:block">
            Use the arrows to see more brands.
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {showArrows ? <ScrollRailPrev scrollId={RAIL_ID} label="Scroll brands left" /> : null}

          <div
            id={RAIL_ID}
            className="min-w-0 flex-1 flex gap-4 px-1 pb-2 overflow-x-auto sm:px-0 sm:gap-5 no-scrollbar scroll-smooth snap-x snap-mandatory"
          >
            {hasItems ? (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={shouldPrefetchHref(item.href)}
                  className="min-w-[200px] sm:min-w-[240px] flex flex-col shrink-0 snap-start text-left"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 640px) 200px, 240px"
                      className="object-cover rounded-2xl"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 w-full rounded-xl bg-white border border-gray-3 px-3 py-2 shadow-sm flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-semibold text-dark text-center">
                      {item.label}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-meta-3 py-4">
                No brand tiles yet — add them under Admin → Marketing → Shop by brand.
              </p>
            )}
          </div>

          {showArrows ? <ScrollRailNext scrollId={RAIL_ID} label="Scroll brands right" /> : null}
        </div>
      </div>
    </section>
  );
}
