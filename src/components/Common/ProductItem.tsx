"use client";
import { useModalContext } from "@/app/context/QuickViewModalContext";
import { EyeIcon } from "@/assets/icons";
import { updateQuickView } from "@/redux/features/quickView-slice";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import { AppDispatch } from "@/redux/store";
import { Product } from "@/types/product";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useCart } from "@/hooks/useCart";
import WishlistButton from "../Wishlist/AddWishlistButton";
import Tooltip from "./Tooltip";
import { calculateDiscountPercentage } from "@/utils/calculateDiscountPercentage";
import { formatPrice } from "@/utils/formatePrice";

type Props = {
  bgClr?: string;
  item: Product;
};
// add updated the type here
const ProductItem = ({ item, bgClr = "white" }: Props) => {
  const displayTitle = item.title;
  const defaultVariant = item?.productVariants.find((variant) => variant.isDefault);
  const firstVariantWithImage = item?.productVariants.find((variant) => Boolean(variant.image));
  // Prefer default variant image, then any variant image, then first product image
  const cardImage =
    item.image ||
    defaultVariant?.image ||
    firstVariantWithImage?.image ||
    item.product_images?.[0]?.url ||
    "";
  const variantPreview = item.productVariants
    .filter((variant) => Boolean(variant.color || variant.name))
    .slice(0, 4);
  const { openModal } = useModalContext();
  // const [product, setProduct] = useState({});
  const dispatch = useDispatch<AppDispatch>();

  const { addItem, cartDetails, incrementItem, decrementItem } = useCart();

  const isAlradyAdded = Object.values(cartDetails ?? {}).some(
    (cartItem) => cartItem.id === item.id
  );
  const currentQty = (cartDetails?.[item.id]?.quantity ?? 0) as number;

  const cartItem = {
    id: item.id,
    name: displayTitle,
    price: item.discountedPrice ? item.discountedPrice : item.price,
    shippingPerUnit: Number(item.shippingPerUnit ?? 0),
    currency: "usd",
    image: cardImage,
    slug: item?.slug,
    availableQuantity: item.quantity,
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
          : item.updatedAt, // ✅ Convert Date to ISO string
    };
    dispatch(updateQuickView(serializableItem));
  };

  // add to cart
  const handleAddToCart = (item: Product) => {
    if (item.quantity > 0) {
      // @ts-ignore
      addItem(cartItem);
      toast.success("Product added to cart!");
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
        image: cardImage,
        price: item.discountedPrice ? item.discountedPrice : item.price,
        quantity: item.quantity,
        color: defaultVariant?.color ? defaultVariant.color : "",
      })
    );
  };

  return (
    <div className="group rounded-xl border border-gray-7 bg-white p-3 sm:p-4">
      <div
        className={`relative overflow-hidden border border-white flex items-center justify-center rounded-xl bg-${bgClr} min-h-[270px] mb-4`}
      >
        <Link
          href={`/shop/${item?.slug}`}
        >
          <Image
            src={cardImage || "/images/404.svg"}
            alt={item.title || "product-image"}
            width={250}
            height={250}
          />
        </Link>
        <div className="absolute top-2 right-2">
          {item.quantity < 1 ? (
            <span className="px-2 py-1 text-xs font-medium text-white bg-amber-600 rounded-full">
              Out of Stock
            </span>
          ) : item?.discountedPrice && item?.discountedPrice > 0 ? (
            <span className="px-2 py-1 text-xs font-medium text-white rounded-full bg-blue">
              {calculateDiscountPercentage(item.discountedPrice, item.price)}%
              OFF
            </span>
          ) : null}
        </div>

        <div className="absolute left-0 bottom-0 translate-y-0 lg:translate-y-full w-full flex items-center justify-center gap-2.5 pb-5 ease-linear duration-200 lg:group-hover:translate-y-0">
          <Tooltip content="Quick View" placement="top">
            <button
              className="border border-gray-3 h-[38px] w-[38px] rounded-lg flex items-center justify-center text-dark bg-white hover:text-blue"
              onClick={() => {
                openModal();
                handleQuickViewUpdate();
              }}
            >
              <EyeIcon />
            </button>
          </Tooltip>

          {isAlradyAdded ? (
            <div className="inline-flex items-center rounded-lg border border-gray-3 bg-white">
              <button
                onClick={() => decrementItem(item.id)}
                className="px-3 py-2 text-dark hover:bg-gray-1"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="px-3 py-2 text-sm font-medium text-dark">
                {currentQty}
              </span>
              <button
                onClick={() => incrementItem(item.id)}
                className="px-3 py-2 text-dark hover:bg-gray-1"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleAddToCart(item)}
              disabled={item.quantity < 1}
              className="inline-flex px-5 py-2 font-medium h-[38px] text-white duration-200 ease-out rounded-lg text-custom-sm bg-blue hover:bg-blue-dark"
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

      <h3 className="font-semibold text-dark ease-out text-base duration-200 hover:text-blue mb-1.5 line-clamp-1">
        <Link
          href={`/shop/${item?.slug}`}
        >
          {" "}
          {displayTitle}{" "}
        </Link>
      </h3>

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
                <Image
                  src={thumb}
                  alt={label}
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 rounded-full object-cover"
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
};

export default ProductItem;
