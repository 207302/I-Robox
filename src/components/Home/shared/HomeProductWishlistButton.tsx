"use client";

import { startTransition, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { HeartIcon, HeartSolid } from "@/assets/icons";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import { useAppSelector } from "@/redux/store";
import type { HomeProductCardItem } from "./HomeProductCard";

export default function HomeProductWishlistButton({
  productId,
  slug,
  title,
  image,
  price,
}: Pick<HomeProductCardItem, "productId" | "slug" | "title" | "image" | "price">) {
  const dispatch = useDispatch();
  const wishlistItems = useAppSelector((state) => state.wishlistReducer.items ?? []);
  const isWishlisted = wishlistItems.some((w) => String(w.id) === String(productId));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dispatch(
      addItemToWishlist({
        id: productId,
        slug,
        title,
        image,
        price,
        quantity: 1,
      })
    );
    if (!isWishlisted) toast.success("Added to wishlist");
  }

  if (!mounted) {
    return (
      <span className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm" />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isWishlisted ? "In wishlist" : "Add to wishlist"}
      className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-dark shadow-sm transition hover:bg-white"
    >
      {isWishlisted ? <HeartSolid width={16} height={16} /> : <HeartIcon width={16} height={16} />}
    </button>
  );
}
