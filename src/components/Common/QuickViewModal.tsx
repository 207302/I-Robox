"use client";
import { usePreviewSlider } from "@/app/context/PreviewSliderContext";
import { useModalContext } from "@/app/context/QuickViewModalContext";
import {
  CircleCheckIcon,
  CloseLine,
  FullScreenIcon,
  HeartIcon,
  MinusIcon,
  PlusIcon,
} from "@/assets/icons";
import { updateproductDetails } from "@/redux/features/product-details";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import { AppDispatch, useAppSelector } from "@/redux/store";
import { formatPrice } from "@/utils/formatePrice";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useCart } from "@/hooks/useCart";
import {
  buildCartLineId,
  formatVariantLabel,
  pickDefaultVariant,
} from "@/lib/cart/cartLine";
import { resolveMaxOrderQuantity } from "@/lib/cart/maxOrderQuantity";
import type { CartItem } from "@/redux/features/cart-slice";
import ReviewStar from "../Shop/ReviewStar";
import {
  getDefaultGalleryIndex,
  getProductCardImageUrl,
  getProductGalleryImages,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/shop/productCardImage";

/** Horizontal thumbnail rail — scroll only the rail, not the page. */
function scrollThumbnailIntoRail(rail: HTMLDivElement, thumb: HTMLElement) {
  const targetLeft = thumb.offsetLeft - (rail.clientWidth - thumb.offsetWidth) / 2;
  const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
  rail.scrollTo({
    left: Math.max(0, Math.min(targetLeft, maxScroll)),
    behavior: "smooth",
  });
}

const QuickViewModal = () => {
  const { isModalOpen, closeModal } = useModalContext();
  const { openPreviewModal } = usePreviewSlider();
  const [quantity, setQuantity] = useState(1);
  const dispatch = useDispatch<AppDispatch>();
  const { addItem } = useCart();
  const [avgRating, setAvgRating] = useState(0);
  const [totalRating, setTotalRating] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);

  // get the product data
  const product = useAppSelector((state) => state.quickViewReducer.value);
  const [activePreview, setActivePreview] = useState(0);
  const thumbnailRailDesktopRef = useRef<HTMLDivElement>(null);
  const thumbnailRailMobileRef = useRef<HTMLDivElement>(null);

  const galleryImages = product?.title ? getProductGalleryImages(product) : [];
  const mainImage = galleryImages[activePreview] ?? PRODUCT_IMAGE_PLACEHOLDER;
  const showThumbnails = galleryImages.length > 1;

  const variants = product?.productVariants ?? [];
  const hasVariants = variants.length > 0;
  const defaultVariant = pickDefaultVariant(variants);
  const cardImage =
    getProductCardImageUrl(product) || PRODUCT_IMAGE_PLACEHOLDER;
  const cartLineId = product?.id
    ? buildCartLineId(String(product.id), defaultVariant?.id, hasVariants)
    : "";
  const maxOrderQty = resolveMaxOrderQuantity(
    (product as { maxOrderQuantity?: number }).maxOrderQuantity
  );
  const maxSelectableQty = Math.min(
    product?.quantity ?? 0,
    maxOrderQty
  );

  // preview modal
  const handlePreviewSlider = () => {
    dispatch(
      updateproductDetails({
        ...product,
        updatedAt: product.updatedAt,
      })
    );
    openPreviewModal(activePreview);
  };

  // add to cart
  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: cartLineId,
      productId: String(product.id),
      variantId: defaultVariant?.id ?? null,
      variantLabel: formatVariantLabel(defaultVariant),
      name: product.title,
      price: product.discountedPrice ? product.discountedPrice : product.price,
      quantity: 1,
      shippingPerUnit: Number((product as { shippingPerUnit?: number }).shippingPerUnit ?? 0),
      currency: "usd",
      image: cardImage,
      slug: product?.slug,
      availableQuantity: product.quantity,
      maxOrderQuantity: maxOrderQty,
      brandId: (product as { brandId?: string | null }).brandId ?? null,
      color: defaultVariant?.color ? defaultVariant.color : "",
      size: defaultVariant?.size ? defaultVariant.size : "",
    };
    if (product.quantity > 0) {
      const added = addItem({ ...cartItem, quantity });
      if (added) {
        toast.success("Product added to cart!");
        closeModal();
      }
    } else {
      toast.error("This product is out of stock!");
    }
  };

  const handleAddToWishlist = () => {
    dispatch(
      addItemToWishlist({
        id: product.id,
        title: product.title,
        slug: product.slug,
        image: cardImage,
        price: product.discountedPrice
          ? product.discountedPrice
          : product.price,
        quantity: product.quantity,
        color: defaultVariant?.color ? defaultVariant.color : "",
      })
    );
  };
  const isAlreadyInWishlist = useAppSelector((state) =>
    state.wishlistReducer.items?.some((item) => item.id === product.id)
  );

  useEffect(() => {
    // closing modal while clicking outside
    function handleClickOutside(event: any) {
      if (!event.target.closest(".modal-content")) {
        closeModal();
      }
    }

    if (isModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      setQuantity(1);
    };
  }, [isModalOpen, closeModal]);

  useEffect(() => {
    if (!isModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (product?.title) {
      const gallery = getProductGalleryImages(product);
      setActivePreview(getDefaultGalleryIndex(product, gallery));
    }
  }, [product?.id, product?.title]);

  /** Keep the active thumbnail visible in the desktop (vertical) or mobile (horizontal) rail. */
  useEffect(() => {
    if (!isModalOpen || !showThumbnails) return;
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    const rail = mobile ? thumbnailRailMobileRef.current : thumbnailRailDesktopRef.current;
    const thumb = rail?.querySelector<HTMLElement>(
      `[data-thumb-index="${activePreview}"]`
    );
    if (!rail || !thumb) return;
    if (mobile) scrollThumbnailIntoRail(rail, thumb);
    else thumb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activePreview, isModalOpen, showThumbnails]);

  useEffect(() => {
    if (product?.slug) {
      const loadReviews = async () => {
        try {
          const res = await fetch("/api/review", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ productSlug: product.slug }),
          });
          const data = await res.json();
          setTotalRating(data?.review?.length);
          setAvgRating(
            data?.review?.reduce(
              (acc: number, review: any) => acc + review?.ratings,
              0
            ) / data?.review?.length
          );
          setLoading(false);
        } catch {
          setLoading(false);
        }
      };
      void loadReviews();
    }
  }, [product?.slug]);

  return (
    <>
      {product?.title && (
        <div
          className={`${
            isModalOpen ? "z-99999" : "hidden"
          } fixed inset-0 flex items-center justify-center overflow-hidden bg-dark/70 px-4 py-5 sm:px-8 sm:py-8`}
        >
            <div className="modal-content relative flex max-h-[calc(100dvh-2.5rem)] w-full max-w-[1100px] flex-col overflow-x-hidden overflow-y-auto rounded-xl bg-white p-7.5 shadow-3">
              <button
                onClick={() => closeModal()}
                className="absolute top-0 right-0 flex items-center justify-center duration-150 ease-in rounded-full sm:top-6 sm:right-6 text-body hover:text-dark"
              >
                <span className="sr-only">Close modal</span>
                <CloseLine />
              </button>

              <div className="flex min-h-0 flex-1 flex-wrap items-start gap-12.5 overflow-hidden">
                <div className="w-full max-w-[526px]">
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
                    {showThumbnails ? (
                      <div
                        ref={thumbnailRailDesktopRef}
                        className="hidden max-h-[30rem] min-h-0 w-20 shrink-0 overflow-y-auto overflow-x-hidden pr-1 no-scrollbar sm:block"
                        aria-label="Product image thumbnails"
                      >
                        <div className="flex flex-col gap-5">
                          {galleryImages.map((thumb, key) => (
                            <button
                              type="button"
                              data-thumb-index={key}
                              onClick={() => setActivePreview(key)}
                              key={`desktop-${thumb}-${key}`}
                              className={`flex h-20 w-20 shrink-0 flex-none items-center justify-center overflow-hidden rounded-lg bg-gray-1 ease-out duration-200 hover:border-2 hover:border-blue ${
                                activePreview === key ? "border-2 border-blue" : "border-transparent"
                              }`}
                            >
                              <Image
                                src={thumb}
                                alt="thumbnail"
                                width={61}
                                height={61}
                                className="aspect-square object-contain"
                                loading="lazy"
                                sizes="61px"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="relative z-1 aspect-[4/3] w-full overflow-hidden rounded-lg border border-gray-3 bg-gray-1 sm:aspect-auto sm:min-h-[508px] sm:max-h-[min(508px,calc(100dvh-12rem))]">
                        <button
                          type="button"
                          onClick={handlePreviewSlider}
                          className="gallery__Image absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-1 duration-200 ease-out text-dark hover:text-blue sm:right-4 sm:top-4"
                        >
                          <span className="sr-only">Fullscreen</span>
                          <FullScreenIcon />
                        </button>

                        <Image
                          src={mainImage}
                          alt={product.title || "product preview"}
                          fill
                          className="object-contain p-2 sm:p-4"
                          sizes="(max-width: 640px) 100vw, 526px"
                          priority
                          fetchPriority="high"
                        />
                      </div>

                      {showThumbnails ? (
                        <div
                          ref={thumbnailRailMobileRef}
                          className="flex w-full max-w-full gap-3 overflow-x-auto pb-1 no-scrollbar sm:hidden"
                          aria-label="Product image thumbnails"
                        >
                          {galleryImages.map((thumb, key) => (
                            <button
                              type="button"
                              data-thumb-index={key}
                              onClick={() => setActivePreview(key)}
                              key={`mobile-${thumb}-${key}`}
                              className={`relative aspect-square h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border bg-white ease-out duration-200 ${
                                activePreview === key
                                  ? "border-blue"
                                  : "border-gray-3 hover:border-blue/40"
                              }`}
                            >
                              <Image
                                src={thumb}
                                alt="thumbnail"
                                fill
                                className="object-contain p-2"
                                loading="lazy"
                                sizes="72px"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="max-w-[445px] w-full">
                  {product.discountedPrice &&
                    product.discountedPrice < product.price && (
                      <span className="inline-block text-custom-xs uppercase rounded-full font-medium text-white py-1 px-3 bg-green mb-6.5">
                        sale {""}
                        {Math.round(
                          ((product.price - product.discountedPrice) /
                            product.price) *
                          100
                        )}
                        % OFF
                      </span>
                    )}

                  <h3 className="mb-4 text-xl font-semibold xl:text-heading-5 text-dark">
                    {product.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-5 mb-6">
                    {loading ? (
                      <p>Loading...</p>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* <!-- stars --> */}
                        <ReviewStar avgRating={avgRating} />
                        <span>
                          <span className="text-dark-2">
                            {" "}
                            ( {totalRating} reviews )
                          </span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {product.quantity > 0 ? (
                        <>
                          <CircleCheckIcon className="fill-green" />
                          <span className="text-dark"> In Stock </span>
                        </>
                      ) : (
                        <>
                          <CircleCheckIcon className="fill-red" />
                          <span className="text-body"> Out Of Stock </span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-base line-clamp-3 text-dark-3">
                    {product?.shortDescription}
                  </p>
                  {product.diecastScale ? (
                    <p className="mt-3 text-sm text-meta-3">
                      <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-2.5 py-0.5 text-xs font-medium text-dark">
                        Scale: {product.diecastScale}
                      </span>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap justify-between gap-5 mt-6 mb-7.5">
                    <div>
                      <h4 className="font-medium text-base text-dark-2 mb-3.5">
                        Price
                      </h4>

                      <span className="flex items-center gap-2">
                        <span
                          className={`text-lg font-medium text-dark-4 xl:text-2xl ${product.discountedPrice ? "line-through" : ""
                            }`}
                        >
                          {formatPrice(product.price)}
                        </span>
                        {product.discountedPrice && (
                          <span className="text-xl font-semibold text-dark xl:text-heading-4">
                            {formatPrice(product.discountedPrice)}
                          </span>
                        )}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-medium text-base text-dark-3 mb-3.5">
                        Quantity
                      </h4>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setQuantity((q) => Math.min(maxSelectableQty, q + 1))
                          }
                          disabled={quantity >= maxSelectableQty}
                          className="flex items-center justify-center w-10 h-10 duration-200 ease-out rounded-lg bg-gray-2 text-dark hover:text-blue disabled:opacity-50"
                        >
                          <span className="sr-only">Increase quantity</span>
                          <PlusIcon />
                        </button>

                        <span
                          className="flex items-center justify-center w-20 h-10 font-medium bg-white border rounded-lg border-gray-4 text-dark"
                          x-text="quantity"
                        >
                          {quantity}
                        </span>

                        <button
                          onClick={() =>
                            quantity > 1 && setQuantity(quantity - 1)
                          }
                          className="flex items-center justify-center w-10 h-10 duration-200 ease-out rounded-lg bg-gray-2 text-dark hover:text-blue"
                          disabled={quantity <= 1}
                        >
                          <span className="sr-only">Decrease quantity</span>
                          <MinusIcon />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {hasVariants ? (
                      <Link
                        href={`/shop/${product.slug}`}
                        onClick={() => closeModal()}
                        className="inline-flex py-3 font-medium text-white duration-200 ease-out rounded-lg bg-blue px-7 hover:bg-blue-dark"
                      >
                        View options
                      </Link>
                    ) : (
                      <button
                        disabled={quantity < 1 || product.quantity < 1}
                        onClick={() => handleAddToCart()}
                        className="inline-flex py-3 font-medium text-white duration-200 ease-out rounded-lg bg-blue px-7 hover:bg-blue-dark disabled:opacity-60"
                      >
                        {product.quantity > 0 ? "Add to Cart" : "Out of Stock"}
                      </button>
                    )}

                    <button
                      disabled={isAlreadyInWishlist}
                      onClick={() => handleAddToWishlist()}
                      className="inline-flex items-center gap-2 px-6 py-3 font-medium text-white duration-200 ease-out rounded-lg bg-dark hover:bg-opacity-95"
                    >
                      <HeartIcon />
                      {isAlreadyInWishlist
                        ? "Added to Wishlist"
                        : "Add to Wishlist"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}
    </>
  );
};

export default QuickViewModal;
