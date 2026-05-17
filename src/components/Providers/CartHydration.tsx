"use client";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { loadCartFromStorage as loadCartFromStorageAction } from "@/redux/features/cart-slice";
import { loadCartFromStorage, setStorageScope } from "@/lib/cartStorage";
import { getWishlistStorageKey, setWishlistItems } from "@/redux/features/wishlist-slice";
import { useSession } from "@/hooks/useSession";

/**
 * Loads cart from localStorage after session scope is known (guest vs user id).
 */
export default function CartHydration() {
  const dispatch = useDispatch();
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;

    const scope = user?.id ?? "guest";
    setStorageScope(scope);

    const savedCart = loadCartFromStorage();
    dispatch(loadCartFromStorageAction(savedCart));

    try {
      const raw = localStorage.getItem(getWishlistStorageKey());
      const wishlist = raw ? JSON.parse(raw) : [];
      dispatch(setWishlistItems(Array.isArray(wishlist) ? wishlist : []));
    } catch {
      dispatch(setWishlistItems([]));
    }
  }, [dispatch, isLoading, user?.id]);

  return null;
}
