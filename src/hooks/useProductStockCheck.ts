"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchProductStockCheck,
  lineItemStockError,
  StockCheckError,
  stockLookupKey,
  type ProductStockCheckMap,
  type StockCheckLine,
} from "@/lib/cart/stockCheckClient";

export type StockCheckCartItem = {
  id: string | number;
  name: string;
  quantity: number;
  productId?: string | null;
  variantId?: string | null;
};

function stockLinesFromItems(items: StockCheckCartItem[]): StockCheckLine[] {
  return items
    .map((item) => ({
      productId: String(item.productId ?? "").trim(),
      productVariantId: item.variantId?.trim() || null,
    }))
    .filter((line) => line.productId);
}

function stockLinesKey(items: StockCheckCartItem[]): string {
  return items
    .map((item) => {
      const productId = String(item.productId ?? "").trim();
      if (!productId) return "";
      const variantId = item.variantId?.trim() || "";
      return `${productId}:${variantId}:${item.quantity}`;
    })
    .filter(Boolean)
    .join("|");
}

export function useProductStockCheck(items: StockCheckCartItem[]) {
  const linesKey = stockLinesKey(items);
  const [stockByProductId, setStockByProductId] = useState<ProductStockCheckMap>({});
  const [stockCheckLoading, setStockCheckLoading] = useState(false);
  const [stockCheckFailed, setStockCheckFailed] = useState(false);
  const [stockCheckError, setStockCheckError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [trackedKey, setTrackedKey] = useState<string | null>(null);

  if (trackedKey !== linesKey) {
    setTrackedKey(linesKey);
    setStockCheckLoading(linesKey.length > 0);
    setStockCheckFailed(false);
    setStockCheckError(null);
  }

  useEffect(() => {
    const stockLines = stockLinesFromItems(items);
    if (stockLines.length === 0) {
      setStockByProductId((current) => (Object.keys(current).length === 0 ? current : {}));
      setStockCheckLoading(false);
      setStockCheckFailed(false);
      setStockCheckError(null);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setStockCheckLoading(true);
    setStockCheckFailed(false);
    setStockCheckError(null);

    void (async () => {
      try {
        const products = await fetchProductStockCheck(stockLines, { signal: controller.signal });
        if (!active) return;
        setStockByProductId(products);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setStockByProductId({});
        setStockCheckFailed(true);
        setStockCheckError(
          error instanceof StockCheckError
            ? error.message
            : "Unable to verify stock availability"
        );
      } finally {
        if (active) setStockCheckLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
    // linesKey is the stable identity of the lines closed over above. Depending on `items`
    // restarts this effect every render (Object.values returns a new array) and the cleanup
    // flag skips the finally that clears loading, so checkout stays on "Checking stock…" forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, retryNonce]);

  const stockErrorsByLineId = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const item of items) {
      const productId = String(item.productId ?? "").trim();
      const message = lineItemStockError({
        name: item.name,
        quantity: item.quantity,
        stock: productId ? stockByProductId[stockLookupKey(productId, item.variantId)] : undefined,
      });
      if (message) errors[String(item.id)] = message;
    }
    return errors;
  }, [items, stockByProductId]);

  const hasStockShortfall = Object.keys(stockErrorsByLineId).length > 0;

  return {
    stockCheckLoading,
    stockCheckFailed,
    stockCheckError,
    stockErrorsByLineId,
    hasStockShortfall,
    retryStockCheck: () => {
      setStockCheckLoading(true);
      setStockCheckFailed(false);
      setStockCheckError(null);
      setRetryNonce((n) => n + 1);
    },
  };
}
