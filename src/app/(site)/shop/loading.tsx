export default function ShopLoading() {
  return (
    <section className="overflow-hidden py-10 pb-20">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="h-[28rem] animate-pulse rounded-xl border border-gray-3 bg-gray-1" aria-hidden />
          </aside>
          <div className="flex-1 min-w-0">
            <div className="mb-6 h-8 w-24 animate-pulse rounded-lg bg-gray-1" />
            <div className="grid grid-cols-1 gap-x-7.5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-1" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
