import ShopProductGridSkeleton from "@/components/Shop/ShopProductGridSkeleton";

/** Suspense fallback — reserves grid space to limit CLS while shop shell streams. */
export default function ShopPageFallback() {
  return (
    <section className="overflow-hidden py-10 pb-20" aria-busy="true" aria-label="Loading shop">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="mb-6 h-8 w-24 rounded-lg bg-gray-2 animate-pulse" aria-hidden />
        <div className="shop-page-columns flex flex-col gap-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <div className="hidden lg:block w-64 shrink-0">
            <div className="h-[min(70vh,720px)] rounded-xl border border-gray-3 bg-gray-1 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <ShopProductGridSkeleton />
          </div>
        </div>
      </div>
    </section>
  );
}
