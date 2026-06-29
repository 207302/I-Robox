"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { useCart } from "@/hooks/useCart";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import { AppDispatch, useAppSelector } from "@/redux/store";

type ProductActionsProps = {
  lineId: string;
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
  title: string;
  slug: string;
  image: string;
  price: number;
  discountedPrice?: number | null;
  quantity: number;
  shippingPerUnit?: number;
  brandId?: string | null;
  maxOrderQuantity?: number;
  color?: string;
  size?: string;
};

export default function ProductActions(props: ProductActionsProps) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { addItem } = useCart();
  const wishlistItems = useAppSelector((state) => state.wishlistReducer.items);
  const isAlreadyWishlisted = wishlistItems.some((w) => w.id === props.productId);
  const [localQty, setLocalQty] = useState(1);

  const maxQty = Math.min(
    props.maxOrderQuantity ?? 99,
    Math.max(props.quantity, 0) || 1
  );

  function buildCartPayload(qty: number) {
    return {
      id: props.lineId,
      productId: props.productId,
      variantId: props.variantId ?? null,
      variantLabel: props.variantLabel,
      name: props.title,
      price: props.discountedPrice ? props.discountedPrice : props.price,
      currency: "inr" as const,
      image: props.image,
      slug: props.slug,
      availableQuantity: props.quantity,
      maxOrderQuantity: props.maxOrderQuantity,
      shippingPerUnit: Number(props.shippingPerUnit ?? 0),
      brandId: props.brandId ?? null,
      color: props.color ?? "",
      size: props.size ?? "",
      quantity: qty,
    };
  }

  function handleAddToCart() {
    if (props.quantity < 1) {
      toast.error("This product is out of stock!");
      return;
    }

    const added = addItem(buildCartPayload(localQty));
    if (added) toast.success("Product added to cart!");
  }

  function handleBuyNow() {
    if (props.quantity < 1) {
      toast.error("This product is out of stock!");
      return;
    }

    const added = addItem(buildCartPayload(localQty));
    if (added) router.push("/checkout");
  }

  function handleWishlist() {
    dispatch(
      addItemToWishlist({
        id: props.productId,
        title: props.title,
        slug: props.slug,
        image: props.image,
        price: props.discountedPrice ? props.discountedPrice : props.price,
        quantity: props.quantity,
        color: props.color ?? "",
      })
    );
    if (!isAlreadyWishlisted) toast.success("Added to wishlist");
  }

  function decrementLocalQty() {
    setLocalQty((q) => Math.max(1, q - 1));
  }

  function incrementLocalQty() {
    setLocalQty((q) => Math.min(maxQty, q + 1));
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-0 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={decrementLocalQty}
            className="flex h-10 w-9 items-center justify-center rounded-lg text-lg font-medium text-dark transition hover:bg-white hover:shadow-sm active:scale-95"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={localQty}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              setLocalQty(Math.max(1, Math.min(maxQty, Math.trunc(next))));
            }}
            className="h-10 w-9 border-0 bg-transparent px-0 text-center text-sm font-semibold tabular-nums text-dark outline-none ring-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={incrementLocalQty}
            className="flex h-10 w-9 items-center justify-center rounded-lg text-lg font-medium text-dark transition hover:bg-white hover:shadow-sm active:scale-95"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={props.quantity < 1}
          className="inline-flex min-w-0 flex-1 items-center justify-center rounded-lg bg-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-dark disabled:opacity-60"
        >
          {props.quantity > 0 ? "Add to Cart" : "Out of Stock"}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={props.quantity < 1}
          className="inline-flex min-w-0 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gray-50 disabled:opacity-60"
        >
          Buy Now
        </button>
      </div>

      <button
        type="button"
        onClick={handleWishlist}
        className="mt-3 text-sm font-medium text-blue hover:underline"
      >
        {isAlreadyWishlisted ? "Saved to wishlist" : "Add to wishlist"}
      </button>
    </div>
  );
}
