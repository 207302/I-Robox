"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type CouponRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
};

type MarketingAdminDeferred = {
  popups: unknown[];
  flashSales: unknown[];
  coupons: CouponRow[];
  setPopups: (next: unknown[]) => void;
  setFlashSales: (next: unknown[]) => void;
  setCoupons: (next: CouponRow[]) => void;
  hydrateDeferred: (data: {
    popups: unknown[];
    flashSales: unknown[];
    coupons: CouponRow[];
  }) => void;
};

const MarketingAdminDeferredContext = createContext<MarketingAdminDeferred | null>(null);

export function MarketingAdminDeferredProvider({ children }: { children: ReactNode }) {
  const [popups, setPopups] = useState<unknown[]>([]);
  const [flashSales, setFlashSales] = useState<unknown[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);

  const value = useMemo<MarketingAdminDeferred>(
    () => ({
      popups,
      flashSales,
      coupons,
      setPopups,
      setFlashSales,
      setCoupons,
      hydrateDeferred: (data) => {
        setPopups(data.popups);
        setFlashSales(data.flashSales);
        setCoupons(data.coupons);
      },
    }),
    [popups, flashSales, coupons]
  );

  return (
    <MarketingAdminDeferredContext.Provider value={value}>
      {children}
    </MarketingAdminDeferredContext.Provider>
  );
}

export function useMarketingAdminDeferred() {
  const ctx = useContext(MarketingAdminDeferredContext);
  if (!ctx) {
    throw new Error("useMarketingAdminDeferred must be used within MarketingAdminDeferredProvider");
  }
  return ctx;
}
