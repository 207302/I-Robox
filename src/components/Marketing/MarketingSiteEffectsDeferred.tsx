"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MarketingSiteEffects = dynamic(() => import("./MarketingSiteEffects"), { ssr: false });

/** Defers popup/coupon effects until the main thread is idle (lower homepage TBT). */
export default function MarketingSiteEffectsDeferred() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setReady(true), { timeout: 1000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(() => setReady(true), 1000);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <MarketingSiteEffects />;
}
