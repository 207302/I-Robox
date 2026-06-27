import Image from "next/image";
import Link from "next/link";
import { HOME_PRODUCT_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import { formatPrice } from "@/utils/formatePrice";
import { productImageAlt } from "@/lib/seo/metadata";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";

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
      prefetch={shouldPrefetchHref(`/shop/${item.slug}`)}
      className="group block h-full overflow-hidden rounded-2xl border border-gray-3 bg-white transition-transform duration-200 hover:-translate-y-1 hover:border-blue/40 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-2">
        <Image
          src={item.image}
          alt={productImageAlt(item.title)}
          fill
          sizes={HOME_PRODUCT_CARD_SIZES}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          quality={85}
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
