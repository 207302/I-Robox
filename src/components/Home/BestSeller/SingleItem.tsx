"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Product } from "@/types/product";
import { useModalContext } from "@/app/context/QuickViewModalContext";
import { useDispatch } from "react-redux";
import { AppDispatch, useAppSelector } from "@/redux/store";
import { updateQuickView } from "@/redux/features/quickView-slice";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import { useCart } from "@/hooks/useCart";
import toast from "react-hot-toast";
import ActionBtn from "./ActionBtn";
import {
  buildCartLineId,
  formatVariantLabel,
  pickDefaultVariant,
} from "@/lib/cart/cartLine";
import { formatPrice } from "@/utils/formatePrice";
import { productImageAlt } from "@/lib/seo/metadata";

const SingleItem = ({ item }: { item: Product }) => {
  const hasVariants = (item?.productVariants?.length ?? 0) > 0;
  const defaultVariant = pickDefaultVariant(item?.productVariants ?? []);
  const cartLineId = buildCartLineId(String(item.id), defaultVariant?.id, hasVariants);
  const router = useRouter();
  const { openModal } = useModalContext();
  const dispatch = useDispatch<AppDispatch>();
  const { addItem, cartDetails } = useCart();
  const wishlistItems = useAppSelector((state) => state.wishlistReducer.items);

  const isAlradyAdded = Boolean(cartDetails?.[cartLineId]);

  const isAlradyWishListed = Object.values(wishlistItems ?? {}).some(
    (wishlistItem) => wishlistItem.id === item.id
  )
    ? true
    : false;
  const variantPreview = item.productVariants
    .filter((variant) => Boolean(variant.color || variant.name))
    .slice(0, 4);

  const cartItem = {
    id: cartLineId,
    productId: String(item.id),
    variantId: defaultVariant?.id ?? null,
    variantLabel: formatVariantLabel(defaultVariant),
    name: item.title,
    price: item.discountedPrice ? item.discountedPrice : item.price,
    currency: "usd",
    image: defaultVariant?.image ? defaultVariant.image : "",
    slug: item?.slug,
    availableQuantity: item.quantity,
    maxOrderQuantity: item.maxOrderQuantity,
    brandId: item.brandId ?? null,
    color: defaultVariant?.color ? defaultVariant.color : "",
    size: defaultVariant?.size ? defaultVariant.size : "",
  };

  // update the QuickView state
  const handleQuickViewUpdate = () => {
    const serializableItem = {
      ...item,
      updatedAt:
        item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : item.updatedAt,
    };
    dispatch(updateQuickView(serializableItem));
    openModal();
  };

  // add to cart
  const handleAddToCart = () => {
    if (item.quantity > 0) {
      const added = addItem(cartItem);
      if (added) toast.success("Product added to cart!");
    } else {
      toast.error("This product is out of stock!");
    }
  };

  const handleItemToWishList = () => {
    dispatch(
      addItemToWishlist({
        id: item.id,
        title: item.title,
        slug: item.slug,
        image: defaultVariant?.image ? defaultVariant.image : "",
        price: item.discountedPrice ? item.discountedPrice : item.price,
        quantity: item.quantity,
        color: defaultVariant?.color ? defaultVariant.color : "",
      })
    );
  };

  return (
    <div className="group">
      <div className="relative overflow-hidden rounded-xl bg-[#F6F7FB] min-h-[403px]">
        <div className="text-center px-4 py-7.5">
          <h3 className="font-semibold text-lg text-dark ease-out duration-200 hover:text-blue mb-1.5">
            <Link href={`/shop/${item?.slug}`}>{item.title}</Link>
          </h3>

          <span className="flex items-center justify-center gap-2 text-base font-medium">
            <span className="text-dark">
              {formatPrice(item.discountedPrice || item.price)}
            </span>
            {item.discountedPrice && (
              <span className="line-through text-dark-4 ">
                {formatPrice(item.price)}
              </span>
            )}
          </span>
          {variantPreview.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {variantPreview.map((variant, idx) => {
                const label =
                  variant.color && variant.name && variant.color !== variant.name
                    ? `${variant.color} · ${variant.name}`
                    : variant.color || variant.name || "Variant";
                const thumb =
                  variant.image ||
                  defaultVariant?.image ||
                  item.product_images?.[0]?.url ||
                  "/images/404.svg";
                return (
                  <span
                    key={`${variant.color}-${variant.name}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-3 bg-white px-2 py-0.5 text-[11px] font-medium text-meta-3"
                    title={label}
                  >
                    <Image
                      src={thumb}
                      alt={label}
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 rounded-full object-cover"
                    />
                    <span className="max-w-[90px] truncate">{label}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-center">
          <Link href={`/shop/${item?.slug}`}>
            <Image
              src={defaultVariant?.image ? defaultVariant.image : ""}
              alt={productImageAlt(item.title)}
              width={280}
              height={280}
            />
          </Link>
        </div>

        <div className="absolute right-0 bottom-0  w-full flex flex-col gap-2 p-5.5 ease-linear duration-300 group-hover:translate-x-0 translate-x-full">
          <ActionBtn
            handleClick={handleQuickViewUpdate}
            text="Quick View"
            icon={"quick-view"}
          />

          {hasVariants ? (
            <ActionBtn
              handleClick={() => router.push(`/shop/${item.slug}`)}
              text="View options"
              icon="quick-view"
            />
          ) : isAlradyAdded ? (
            <ActionBtn text="Checkout" icon="check-out" />
          ) : (
            <ActionBtn
              handleClick={() => {
                handleAddToCart();
              }}
              text="Add to cart"
              icon="cart"
              isDisabled={item.quantity < 1 ? true : false}
            />
          )}

          <ActionBtn
            handleClick={handleItemToWishList}
            text="Add to Wishlist"
            icon="wishlist"
            addedToWishlist={isAlradyWishListed}
          />
        </div>
      </div>
    </div>
  );
};

export default SingleItem;
