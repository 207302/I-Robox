"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Resets window scroll on route changes. Without this, back/forward and
 * client navigations can restore the previous page's scrollY (e.g. footer).
 */
export default function ScrollOnNavigate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = search ? `${pathname}?${search}` : pathname;
  const prevRouteKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (prevRouteKeyRef.current === routeKey) return;
    prevRouteKeyRef.current = routeKey;

    window.scrollTo(0, 0);
  }, [routeKey]);

  return null;
}
