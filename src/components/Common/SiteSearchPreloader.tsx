"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SEARCH_PROGRESS_EVENT,
  getSearchProgress,
  type SearchProgressDetail,
} from "@/lib/shop/searchProgress";

const LOGO = "/images/logo/logo1-removebg-preview.png";

type Props = {
  onDone: () => void;
};

export default function SiteSearchPreloader({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);
  const clamped = Math.min(100, Math.max(0, progress));

  useLayoutEffect(() => {
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
      <Image
        src={LOGO}
        alt="i-Robox"
        width={160}
        height={160}
        className="mb-10 h-20 w-auto sm:h-24"
        style={{ width: "auto" }}
        loading="eager"
      />
      <p className="mb-6 text-center text-lg font-semibold text-dark sm:text-xl">Searching....</p>

      <div
        className="site-search-progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="site-search-progress-fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
