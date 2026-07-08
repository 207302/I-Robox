"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";
import { useAccentColoredCarLoader } from "@/hooks/useAccentColoredCarLoader";
import {
  SEARCH_PROGRESS_EVENT,
  getSearchProgress,
  isSearchProgressPending,
  type SearchProgressDetail,
} from "@/lib/shop/searchProgress";

/** Lottie artboard has padding — ~96px matches the old 48px SVG toy loader visually. */
export const SHOP_CAR_DRIVE_SIZE = 96;
const DRIVE_TRACK_HEIGHT_PX = 48;

type Props = {
  className?: string;
  /** Render size in px for standalone icon use. */
  size?: number;
};

/** Compact car loader for shop search (matches storefront accent). */
export default function ShopSearchCarLottie({ className, size = SHOP_CAR_DRIVE_SIZE }: Props) {
  const animationData = useAccentColoredCarLoader();

  return (
    <Lottie
      animationData={animationData}
      loop
      aria-hidden
      className={`shrink-0 ${className ?? ""}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}

type DriveProps = {
  className?: string;
  "aria-label"?: string;
  /** 0–100 — car and fill share this value. */
  progress: number;
};

/** Full-width car + progress bar driven by the same 0–100 value. */
export function ShopSearchCarDriveLoader({
  className = "",
  "aria-label": ariaLabel = "Loading",
  progress,
}: DriveProps) {
  const animationData = useAccentColoredCarLoader();
  const clamped = Math.min(100, Math.max(0, progress));
  const carLeft = `calc((100% - ${SHOP_CAR_DRIVE_SIZE}px) * ${clamped / 100})`;

  return (
    <div
      className={`w-full ${className}`.trim()}
      role="progressbar"
      aria-live="polite"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-busy={clamped < 100}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ height: DRIVE_TRACK_HEIGHT_PX }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: carLeft,
            width: SHOP_CAR_DRIVE_SIZE,
            height: SHOP_CAR_DRIVE_SIZE,
          }}
        >
          <Lottie
            animationData={animationData}
            loop
            aria-hidden
            style={{ width: SHOP_CAR_DRIVE_SIZE, height: SHOP_CAR_DRIVE_SIZE }}
          />
        </div>
      </div>
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-gray-2">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-blue"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** Header → shop navigation uses real search-progress events instead of creep timing. */
export function useHeaderSearchNavProgress(): number | null {
  const [navProgress, setNavProgress] = useState<number | null>(() =>
    isSearchProgressPending() ? getSearchProgress() : null
  );

  useEffect(() => {
    if (!isSearchProgressPending()) {
      setNavProgress(null);
      return;
    }

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<SearchProgressDetail>).detail;
      setNavProgress(detail?.percent ?? 0);
    };

    setNavProgress(getSearchProgress());
    window.addEventListener(SEARCH_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(SEARCH_PROGRESS_EVENT, onProgress);
  }, []);

  return navProgress;
}
