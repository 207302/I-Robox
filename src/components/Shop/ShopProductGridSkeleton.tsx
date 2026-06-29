import {
  shopProductGridClassName,
  type ShopMobileGridColumns,
} from "@/lib/shop/shopGridLayout";

const SKELETON_COUNT = 12;

type Props = {
  count?: number;
  mobileColumns?: ShopMobileGridColumns;
};

export default function ShopProductGridSkeleton({
  count = SKELETON_COUNT,
  mobileColumns = 1,
}: Props) {
  return (
    <div className={shopProductGridClassName(mobileColumns)} aria-hidden>
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
