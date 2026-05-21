const SKELETON_COUNT = 12;

type Props = {
  count?: number;
};

export default function ShopProductGridSkeleton({ count = SKELETON_COUNT }: Props) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-7.5 gap-y-9"
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-3 bg-white p-3 sm:p-4 animate-pulse"
        >
          <div className="mb-4 aspect-square w-full rounded-xl bg-gray-2" />
          <div className="mb-2 h-4 w-4/5 rounded bg-gray-2" />
          <div className="mb-3 h-3 w-1/2 rounded bg-gray-2" />
          <div className="h-5 w-1/3 rounded bg-gray-2" />
        </div>
      ))}
    </div>
  );
}
