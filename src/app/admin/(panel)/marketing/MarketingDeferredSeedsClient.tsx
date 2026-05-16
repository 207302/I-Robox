"use client";

import { useEffect } from "react";
import { useMarketingAdminDeferred } from "./MarketingAdminContext";

type Props = {
  popups: unknown[];
  flashSales: unknown[];
  coupons: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    is_active: boolean;
  }[];
};

export default function MarketingDeferredSeedsClient({ popups, flashSales, coupons }: Props) {
  const { hydrateDeferred } = useMarketingAdminDeferred();

  useEffect(() => {
    hydrateDeferred({ popups, flashSales, coupons });
  }, [popups, flashSales, coupons, hydrateDeferred]);

  return null;
}
