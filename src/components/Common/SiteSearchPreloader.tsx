"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  SEARCH_PROGRESS_EVENT,
  getSearchProgress,
  type SearchProgressDetail,
} from "@/lib/shop/searchProgress";

const ShopSearchCarDriveLoader = dynamic(
  () =>
    import("@/components/Common/ShopSearchCarLottie").then((mod) => ({
      default: mod.ShopSearchCarDriveLoader,
    })),
  { ssr: false }
);

type Props = {
  onDone: () => void;
};

export default function SiteSearchPreloader({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);
  const clamped = Math.min(100, Math.max(0, progress));

  useEffect(() => {
    doneRef.current = false;
    setProgress(getSearchProgress());
  }, []);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<SearchProgressDetail>).detail;
      const next = detail?.percent ?? 0;
      setProgress(next);
      if (next >= 100 && !doneRef.current) {
        doneRef.current = true;
        window.setTimeout(() => onDone(), 300);
      }
    };
    window.addEventListener(SEARCH_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(SEARCH_PROGRESS_EVENT, onProgress);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white px-6"
      role="status"
      aria-live="polite"
      aria-busy={clamped < 100}
      aria-label="Searching"
    >
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-lg font-semibold text-dark sm:text-xl">Searching....</p>
        <ShopSearchCarDriveLoader progress={clamped} aria-label="Searching" />
      </div>
    </div>
  );
}
