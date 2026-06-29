import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/utils/formatePrice";
import { productImageAlt } from "@/lib/seo/metadata";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import HomeProductWishlistButton from "./HomeProductWishlistButton";
import {
  HOME_RAIL_CARD_SHADOW,
  HOME_RAIL_CARD_SHADOW_HOVER,
  HOME_RAIL_CARD_WIDTH,
  HOME_RAIL_IMAGE_HEIGHT,
  HOME_RAIL_IMAGE_SIZES,
  HOME_RAIL_PRODUCT_TEXT_HEIGHT,
} from "./homeRailStyles";

export type HomeProductCardItem = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  discountedPrice?: number | null;
  averageRating?: number | null;
  reviewCount?: number;
};

type Props = {
  item: HomeProductCardItem;
  priority?: boolean;
  showNewBadge?: boolean;
  showSaleBadge?: boolean;
};

function discountPercent(price: number, sale: number) {
  if (price <= 0 || sale >= price) return 0;
  return Math.round(((price - sale) / price) * 100);
}

export default function HomeProductCard({
  item,
  priority = false,
  showNewBadge = false,
  showSaleBadge = false,
}: Props) {
  const onSale = item.discountedPrice != null && item.discountedPrice < item.price;
  const salePrice = onSale ? item.discountedPrice! : item.price;
  const discount = onSale ? discountPercent(item.price, salePrice) : 0;

  return (
    <div
      className={`${HOME_RAIL_CARD_WIDTH} snap-start rounded-2xl ${HOME_RAIL_CARD_SHADOW} ${HOME_RAIL_CARD_SHADOW_HOVER}`}
    >
      <Link
        href={`/shop/${item.slug}`}
        prefetch={shouldPrefetchHref(`/shop/${item.slug}`)}
        className="group relative flex flex-col overflow-hidden rounded-2xl bg-white"
      >
        <div className={`relative ${HOME_RAIL_IMAGE_HEIGHT} w-full overflow-hidden bg-white`}>
          {showNewBadge ? (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              New
            </span>
          ) : null}
          {showSaleBadge && onSale && discount > 0 ? (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-red px-2 py-0.5 text-[10px] font-semibold text-white">
              -{discount}%
            </span>
          ) : null}
          <HomeProductWishlistButton
            productId={item.productId}
            slug={item.slug}
            title={item.title}
            image={item.image}
            price={salePrice}
          />
          <Image
            src={item.image}
            alt={productImageAlt(item.title)}
            fill
            sizes={HOME_RAIL_IMAGE_SIZES}
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
            quality={85}
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        </div>
        <div className={`flex ${HOME_RAIL_PRODUCT_TEXT_HEIGHT} shrink-0 flex-col justify-center gap-1 px-3`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-dark md:text-[0.9375rem]">
            {item.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-dark">{formatPrice(salePrice)}</span>
            {onSale ? (
              <>
                <span className="text-xs line-through text-meta-4">{formatPrice(item.price)}</span>
                {discount > 0 && !showSaleBadge ? (
                  <span className="text-xs font-semibold text-red">-{discount}%</span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
