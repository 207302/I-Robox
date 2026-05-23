"use client";

import { useLayoutEffect, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SCROLL_STORAGE_PREFIX = "scroll-pos:";
const scrollPositions = new Map<string, number>();

function getRouteKey(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

function saveScrollForRoute(routeKey: string) {
  if (typeof window === "undefined") return;
  const y = window.scrollY;
  scrollPositions.set(routeKey, y);
  try {
    sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${routeKey}`, String(y));
  } catch {
    /* quota / private mode */
  }
}

function getSavedScroll(routeKey: string): number | undefined {
  const fromMemory = scrollPositions.get(routeKey);
  if (fromMemory !== undefined) return fromMemory;
  try {
    const raw = sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${routeKey}`);
    if (raw === null) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Restore after layout/images; shop grids need a short delay for full height. */
function restoreScrollPosition(targetY: number) {
  const apply = () => {
    const maxY = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    window.scrollTo(0, Math.min(targetY, maxY));
  };

  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 150);
  window.setTimeout(apply, 350);
}

/**
 * Scroll to top on forward navigations; restore saved position on browser back/forward.
 */
export default function ScrollOnNavigate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = getRouteKey(pathname, search);
  const isPopNavigationRef = useRef(false);
  const prevRouteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      isPopNavigationRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Keep scroll positions current while the user scrolls (before Next.js resets on navigate). */
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveScrollForRoute(routeKey);
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    saveScrollForRoute(routeKey);

    return () => {
      window.removeEventListener("scroll", onScroll);
      saveScrollForRoute(routeKey);
    };
  }, [routeKey]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const previousRouteKey = prevRouteKeyRef.current;
    if (previousRouteKey === routeKey) return;

    const isBack = isPopNavigationRef.current;
    isPopNavigationRef.current = false;

    if (isBack) {
      const savedY = getSavedScroll(routeKey);
      if (savedY !== undefined && savedY > 0) {
        restoreScrollPosition(savedY);
      } else {
        window.scrollTo(0, 0);
      }
    } else {
      window.scrollTo(0, 0);
    }

    prevRouteKeyRef.current = routeKey;
  }, [routeKey]);

  return null;
}
