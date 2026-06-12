"use client";

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  hydrateCartProductMeta,
  loadCartFromStorage as loadCartFromStorageAction,
  selectCartItems,
} from "@/redux/features/cart-slice";
import { loadCartFromStorage, setStorageScope } from "@/lib/cartStorage";
import { getWishlistStorageKey, setWishlistItems } from "@/redux/features/wishlist-slice";
import { useSession } from "@/hooks/useSession";
import { isUuid } from "@/lib/validation/input";
import { clampAddToCartQuantity } from "@/lib/cart/maxOrderQuantity";
import toast from "react-hot-toast";

/**
 * Loads cart from localStorage after session scope is known (guest vs user id),
 * then refreshes per-product limits and shipping rates from the database.
 */
export default function CartHydration() {
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const { user, isLoading } = useSession();
  const lastSyncedKeyRef = useRef("");

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

  useEffect(() => {
    const productIds = [
      ...new Set(
        cartItems
          .map((item) => String(item.productId ?? "").trim())
          .filter((id) => isUuid(id))
      ),
    ];
    if (productIds.length === 0) return;

    const syncKey = productIds.slice().sort().join(",");
    if (syncKey === lastSyncedKeyRef.current) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/cart/product-meta", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productIds }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !data?.products || typeof data.products !== "object") return;

        let adjusted = false;
        for (const item of cartItems) {
          const meta = data.products[String(item.productId)];
          if (!meta) continue;
          const cappedQty = clampAddToCartQuantity({
            items: cartItems,
            productId: item.productId,
            lineId: item.id,
            requestedQty: item.quantity,
            maxOrderQuantity: meta.maxOrderQuantity,
            availableQuantity: meta.availableQuantity,
          });
          if (cappedQty !== item.quantity) adjusted = true;
        }

        dispatch(hydrateCartProductMeta(data.products));
        lastSyncedKeyRef.current = syncKey;

        if (adjusted) {
          toast.error("Some cart quantities were adjusted to match product limits or stock.");
        }
      } catch {
        // Ignore — checkout APIs still enforce limits server-side.
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cartItems, dispatch]);

  return null;
}
