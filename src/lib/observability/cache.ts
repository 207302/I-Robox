import "server-only";

import { recordCacheMiss } from "@/lib/observability/context";
import { isPerfLogEnabled } from "@/lib/observability/config";
import { perfLog } from "@/lib/observability/logger";

/**
 * Wrap a loader passed to `unstable_cache` — runs only on cache miss.
 * Logs `cache_miss` when PERF_LOG=1 or when inside an active perf context.
 */
export function onCacheMiss<T>(cacheName: string, loader: () => Promise<T>): () => Promise<T> {
  return async () => {
    recordCacheMiss(cacheName);
    if (isPerfLogEnabled()) {
      perfLog("cache_miss", { cache: cacheName }, true);
    }
    return loader();
  };
}
