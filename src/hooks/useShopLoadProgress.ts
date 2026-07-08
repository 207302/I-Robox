"use client";

import { useEffect, useRef, useState } from "react";

const CAP_WHILE_LOADING = 90;
/** Time to creep toward the cap while waiting for results — keeps the bar slow. */
const CREEP_DURATION_MS = 4200;
/** Finish animation once results are ready. */
const SETTLE_DURATION_MS = 450;

/**
 * Progress that creeps slowly while `loading`, then completes to 100% when loading ends
 * so the bar reaches the right edge as results appear.
 */
export function useShopLoadProgress(loading: boolean) {
  const [progress, setProgress] = useState(0);
  const [settling, setSettling] = useState(false);
  const loadingRef = useRef(loading);
  const progressRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  progressRef.current = progress;

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (loading) {
      setSettling(false);
      if (!loadingRef.current) {
        startRef.current = performance.now();
        progressRef.current = 0;
        setProgress(0);
      }
      loadingRef.current = true;

      const tick = (now: number) => {
        if (!loadingRef.current) return;
        const elapsed = now - startRef.current;
        const t = Math.min(1, elapsed / CREEP_DURATION_MS);
        const eased = 1 - (1 - t) ** 2.2;
        const next = eased * CAP_WHILE_LOADING;
        progressRef.current = next;
        setProgress(next);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const wasLoading = loadingRef.current;
    loadingRef.current = false;

    if (!wasLoading && progressRef.current >= 100) {
      setSettling(false);
      return;
    }

    const from = progressRef.current;
    if (from >= 100) {
      setSettling(false);
      return;
    }

    setSettling(true);
    const settleStart = performance.now();

    const settle = (now: number) => {
      const t = Math.min(1, (now - settleStart) / SETTLE_DURATION_MS);
      const eased = 1 - (1 - t) ** 2;
      const next = from + (100 - from) * eased;
      progressRef.current = next;
      setProgress(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(settle);
      } else {
        setSettling(false);
      }
    };

    rafRef.current = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loading]);

  return {
    progress: Math.min(100, Math.max(0, progress)),
    showLoader: loading || settling,
  };
}
