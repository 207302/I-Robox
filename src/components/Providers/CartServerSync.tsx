"use client";

import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";

const DEBOUNCE_MS = 12_000;

/**
 * Persists the Redux cart to the server for logged-in users so abandoned-cart cron can email.
 */
export default function CartServerSync() {
  const items = useSelector((s: RootState) => s.cartReducer?.items ?? []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const payload = items
          .map((i) => ({
            productId: String(i.productId ?? i.id),
            quantity: i.quantity,
          }))
          .filter((i) => i.productId.length > 10 && i.quantity > 0);
        await fetch("/api/account/cart-sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: payload }),
        });
      } catch {
        /* ignore */
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items]);

  return null;
}
