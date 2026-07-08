"use client";

import { ShopSearchCarDriveLoader } from "@/components/Common/ShopSearchCarLottie";
import { useShopLoadProgress } from "@/hooks/useShopLoadProgress";

/** Creeping car + bar while the shop Suspense shell streams in. */
export default function ShopPageFallbackLoader() {
  const { progress } = useShopLoadProgress(true);
  return <ShopSearchCarDriveLoader progress={progress} aria-label="Loading products" />;
}
