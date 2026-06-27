"use client";
import { memo, useCallback, useMemo } from "react";
import { useModalContext } from "@/app/context/QuickViewModalContext";
import { EyeIcon } from "@/assets/icons";
import { updateQuickView } from "@/redux/features/quickView-slice";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import { AppDispatch } from "@/redux/store";
import { Product } from "@/types/product";
import SafeProductImage from "@/components/Common/SafeProductImage";
import Link from "next/link";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useCart } from "@/hooks/useCart";
import dynamic from "next/dynamic";
import WishlistButton from "../Wishlist/AddWishlistButton";
import { PRODUCT_CARD_GRID_SIZES } from "@/lib/shop/productCardGridSizes";
import {
  cloudinaryProductCardUrl,
  cloudinaryProductCardSrcSet,
  isCloudinaryDeliveryUrl,
} from "@/lib/images/cloudinaryDeliver";
import { calculateDiscountPercentage } from "@/utils/calculateDiscountPercentage";
import {
  buildCartLineId,
  formatVariantLabel,
  pickDefaultVariant,
} from "@/lib/cart/cartLine";
import { formatPrice } from "@/utils/formatePrice";
import { productImageAlt } from "@/lib/seo/metadata";

const Tooltip = dynamic(() => import("./Tooltip"), { ssr: false });

type Props = {
  bgClr?: string;
  item: Product;
  /** Passed from shop (and similar grids) so `next/image` emits correct `srcset` widths. */
  cardImageSizes?: string;
  /**
   * Shop listing only: first visible row vs below the fold.
   * Omit on home/other pages — default Next/image lazy behavior.
   */
  shopListingImage?: "lcp" | "eager" | "lazy";
};
// add updated the type here
function ProductItemInner({
  item,
  bgClr = "white",
  cardImageSizes = PRODUCT_CARD_GRID_SIZES,
  shopListingImage,
}: Props) {
  const displayTitle = item.title;
  const hasVariants = (item?.productVariants?.length ?? 0) > 0;
  const defaultVariant = pickDefaultVariant(item?.productVariants ?? []);
  const firstVariantWithImage = item?.productVariants.find((variant) => Boolean(variant.image));
  const cartVariant = defaultVariant ?? firstVariantWithImage;
  const cartLineId = buildCartLineId(
    String(item.id),
    cartVariant?.id,
    hasVariants
  );
  const cardImage = useMemo(
    () =>
      item.image ||
      defaultVariant?.image ||
      firstVariantWithImage?.image ||
      item.product_images?.[0]?.url ||
      "",
    [item, defaultVariant?.image, firstVariantWithImage?.image]
  );
  const cardImageSrc = useMemo(() => {
    if (!cardImage || !isCloudinaryDeliveryUrl(cardImage)) return cardImage;
    return cloudinaryProductCardUrl(cardImage, shopListingImage !== undefined ? 380 : 220);
  }, [cardImage, shopListingImage]);
  const cardImageDelivery = useMemo(() => {
    if (!cardImage || !isCloudinaryDeliveryUrl(cardImage)) {
      return { src: cardImageSrc, srcSet: undefined as string | undefined };
    }
    if (shopListingImage !== undefined) {
      const { src, srcSet } = cloudinaryProductCardSrcSet(cardImage);
      return { src, srcSet };
    }
    return { src: cardImageSrc, srcSet: undefined as string | undefined };
  }, [cardImage, cardImageSrc, shopListingImage]);
  const variantPreview = useMemo(
    () =>
      item.productVariants
        .filter((variant) => Boolean(variant.color || variant.name))
        .slice(0, 4),
    [item.productVariants]
  );
  const { openModal } = useModalContext();
  const dispatch = useDispatch<AppDispatch>();

  const { addItem, cartDetails, incrementItem, decrementItem } = useCart();

  const isAlradyAdded = Boolean(cartDetails?.[cartLineId]);
  const currentQty = (cartDetails?.[cartLineId]?.quantity ?? 0) as number;

  const cartItem = useMemo(
    () => ({
      id: cartLineId,
      productId: String(item.id),
      variantId: cartVariant?.id ?? null,
      variantLabel: formatVariantLabel(cartVariant),
      name: displayTitle,
      price: item.discountedPrice ? item.discountedPrice : item.price,
      shippingPerUnit: Number(item.shippingPerUnit ?? 0),
      currency: "usd",
      image: cardImage,
      slug: item?.slug,
      availableQuantity: item.quantity,
      maxOrderQuantity: item.maxOrderQuantity,
      brandId: item.brandId ?? null,
      color: cartVariant?.color ? cartVariant.color : "",
      size: cartVariant?.size ? cartVariant.size : "",
    }),
    [item, displayTitle, cardImage, cartLineId, cartVariant]
  );

  const handleQuickViewUpdate = useCallback(() => {
    const serializableItem = {
      ...item,
      updatedAt:
        item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    };
    dispatch(updateQuickView(serializableItem));
  }, [dispatch, item]);

  const handleAddToCart = useCallback(() => {
    if (item.quantity > 0) {
      const added = addItem(cartItem);
      if (added) toast.success("Product added to cart!");
    } else {
      toast.error("This product is out of stock!");
    }
  }, [addItem, cartItem, item.quantity]);

  const handleQuickViewOpen = useCallback(() => {
    openModal();
    handleQuickViewUpdate();
  }, [openModal, handleQuickViewUpdate]);

  const handleItemToWishList = useCallback(() => {
    dispatch(
      addItemToWishlist({
        id: item.id,
        title: item.title,
        slug: item.slug,
        image: cardImage,
        price: item.discountedPrice ? item.discountedPrice : item.price,
        quantity: item.quantity,
        color: defaultVariant?.color ? defaultVariant.color : "",
      })
    );
  }, [dispatch, item, cardImage, defaultVariant?.color]);

  const handleDecrement = useCallback(() => {
    decrementItem(cartLineId);
  }, [decrementItem, cartLineId]);

  const handleIncrement = useCallback(() => {
    incrementItem(cartLineId);
  }, [incrementItem, cartLineId]);

  const mainImagePriority = shopListingImage === "lcp";
  const listingLoadingProp =
    shopListingImage === "lazy"
      ? ("lazy" as const)
      : shopListingImage
        ? ("eager" as const)
        : undefined;

  return (
    <div className="group rounded-xl bg-white p-3 sm:p-4 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.14),0_2px_8px_-2px_rgba(0,0,0,0.10)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_20px_48px_-6px_rgba(0,0,0,0.22),0_8px_20px_-4px_rgba(0,0,0,0.14)]">
      <div
        className={`relative mb-4 flex aspect-square w-full max-h-[min(280px,92vw)] items-center justify-center overflow-hidden rounded-xl border border-white bg-${bgClr}`}
      >
        <Link
          href={`/shop/${item?.slug}`}
          className="relative block h-full w-full"
          prefetch={shopListingImage !== undefined ? false : undefined}
        >
          <SafeProductImage
            src={cardImageDelivery.src}
            {...(cardImageDelivery.srcSet ? { srcSet: cardImageDelivery.srcSet } : {})}
            alt={productImageAlt(item.title)}
            width={640}
            height={640}
            sizes={cardImageSizes}
            className="h-full w-full object-contain"
            priority={mainImagePriority}
            {...(shopListingImage === "lcp" ? { fetchPriority: "high" as const } : {})}
            {...(listingLoadingProp ? { loading: listingLoadingProp } : {})}
            unoptimized={isCloudinaryDeliveryUrl(cardImageDelivery.src)}
          />
        </Link>
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex h-[26px] w-[4.5rem] shrink-0 items-center justify-end">
          {item.quantity < 1 ? (
            <span className="pointer-events-auto rounded-full bg-amber-600 px-2 py-1 text-xs font-medium text-white">
              Out of Stock
            </span>
          ) : item?.discountedPrice && item?.discountedPrice > 0 ? (
            <span className="pointer-events-auto rounded-full bg-blue px-2 py-1 text-xs font-medium text-white tabular-nums">
              {calculateDiscountPercentage(item.discountedPrice, item.price)}%
              OFF
            </span>
          ) : (
            <span className="h-[26px] w-px shrink-0 opacity-0" aria-hidden />
          )}
        </div>

        <div className="absolute left-0 bottom-0 translate-y-0 lg:translate-y-full w-full flex items-center justify-center gap-2.5 pb-5 ease-linear duration-200 lg:group-hover:translate-y-0">
          <Tooltip content="Quick View" placement="top">
            <button
              type="button"
              className="border border-gray-3 h-[38px] w-[38px] rounded-lg flex items-center justify-center text-dark bg-white hover:text-blue active:scale-95"
              onClick={handleQuickViewOpen}
              aria-label={`Quick view ${displayTitle}`}
            >
              <EyeIcon />
            </button>
          </Tooltip>

          {hasVariants ? (
            <Link
              href={`/shop/${item.slug}`}
              className="inline-flex h-[38px] items-center justify-center rounded-lg border border-gray-3 bg-white px-5 text-custom-sm font-medium text-dark hover:border-blue/40 hover:text-blue"
            >
              View options
            </Link>
          ) : isAlradyAdded ? (
            <div className="inline-flex items-center rounded-lg border border-gray-3 bg-white">
              <button
                type="button"
                onClick={handleDecrement}
                className="px-3 py-2 text-dark hover:bg-gray-1 active:bg-gray-2"
                aria-label="Remove from cart"
              >
                -
              </button>
              <span className="px-3 py-2 text-sm font-medium text-dark">
                {currentQty}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                className="px-3 py-2 text-dark hover:bg-gray-1 active:bg-gray-2"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={item.quantity < 1}
              aria-label={
                item.quantity > 0
                  ? `Add ${displayTitle} to cart`
                  : `${displayTitle} is out of stock`
              }
              className="inline-flex px-5 py-2 font-medium h-[38px] text-white duration-200 ease-out rounded-lg text-custom-sm bg-blue hover:bg-blue-dark active:scale-[0.98] disabled:opacity-60"
            >
              {item.quantity > 0 ? "Add to Cart" : "Out of Stock"}
            </button>
          )}
          {/* wishlist button */}
          <WishlistButton
            item={item}
            handleItemToWishList={handleItemToWishList}
          />
        </div>
      </div>

      <h2 className="font-semibold text-dark ease-out text-base duration-200 hover:text-blue mb-1.5 line-clamp-1">
        <Link
          href={`/shop/${item?.slug}`}
        >
          {" "}
          {displayTitle}{" "}
        </Link>
      </h2>

      {item.ageGroup || item.diecastScale ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {item.ageGroup ? (
            <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-2 py-0.5 text-[11px] font-medium text-meta-3">
              Age: {item.ageGroup}
            </span>
          ) : null}
          {item.diecastScale ? (
            <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-2 py-0.5 text-[11px] font-medium text-meta-3">
              Scale: {item.diecastScale}
            </span>
          ) : null}
        </div>
      ) : null}

      {variantPreview.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {variantPreview.map((variant, idx) => {
            const label =
              variant.color && variant.name && variant.color !== variant.name
                ? `${variant.color} · ${variant.name}`
                : variant.color || variant.name || "Variant";
            const thumb = variant.image || cardImage || "/images/404.svg";
            return (
              <span
                key={`${variant.color}-${variant.name}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-3 bg-white px-2 py-0.5 text-[11px] font-medium text-meta-3"
                title={label}
              >
                <SafeProductImage
                  src={thumb}
                  alt={label}
                  width={14}
                  height={14}
                  loading="lazy"
                  className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
                />
                <span className="max-w-[88px] truncate">{label}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      <span className="flex items-center gap-2 text-base font-medium">
        {item.discountedPrice ? (
          <>
            <span className="text-blue font-semibold">{formatPrice(item.discountedPrice)}</span>
            <span className="text-sm text-meta-4 line-through">{formatPrice(item.price)}</span>
          </>
        ) : (
          <span className="text-dark">{formatPrice(item.price)}</span>
        )}
      </span>
    </div>
  );
}

export default memo(ProductItemInner);
