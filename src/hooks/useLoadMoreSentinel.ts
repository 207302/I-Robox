"use client";

import { useEffect, useRef } from "react";

/**
 * Automatic infinite scroll: calls `loadMore` when the returned sentinel
 * element scrolls within `rootMargin` of the viewport. `loadMore` must be
 * self-guarding against concurrent/duplicate calls.
 *
 * `resetKey` (e.g. the current page number) recreates the observer after each
 * load so a sentinel that is still on-screen immediately triggers the next
 * page — observers only fire on intersection *changes* otherwise.
 */
export function useLoadMoreSentinel(
  loadMore: () => void | Promise<void>,
  hasMore: boolean,
  resetKey: unknown,
  // Must exceed the mobile footer height (~1400px): if the user (or a
  // scroll-position restore) lands at the very bottom of the page, the
  // sentinel sits an entire footer above the viewport. With a smaller
  // margin it never intersects and infinite scroll stalls at the footer.
  rootMargin = "1800px 0px"
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreRef.current();
        }
      },
      { rootMargin, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, resetKey, rootMargin]);

  return sentinelRef;
}
