import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/utils/formatePrice";

export type HomeProductCardItem = {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  discountedPrice?: number | null;
};

export default function HomeProductCard({
  item,
  priority = false,
}: {
  item: HomeProductCardItem;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/shop/${item.slug}`}
      className="group block h-full overflow-hidden rounded-2xl border border-gray-3 bg-white hover:border-blue/40"
    >
      <div className="relative aspect-square bg-gray-2">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 640px) calc(50vw - 1rem), (max-width: 1024px) calc(33vw - 1rem), 220px"
          className="object-cover"
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-dark">{item.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          {item.discountedPrice != null ? (
            <>
              <span className="text-sm font-semibold text-blue">
                {formatPrice(item.discountedPrice)}
              </span>
              <span className="text-xs line-through text-meta-4">{formatPrice(item.price)}</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-dark">{formatPrice(item.price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
