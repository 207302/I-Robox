"use client";

import { useEffect, useState } from "react";

let cachedUsage: Record<string, number> | null = null;
let inflight: Promise<Record<string, number>> | null = null;

async function fetchClaimUsage(): Promise<Record<string, number>> {
  if (cachedUsage) return cachedUsage;
  if (inflight) return inflight;
  inflight = fetch("/api/flash-sale/my-claims", { credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) return {};
      const data = (await res.json()) as {
        usage?: Record<string, number>;
        tags?: string[];
      };
      const usage: Record<string, number> = { ...(data.usage ?? {}) };
      if (!data.usage) {
        for (const tag of data.tags ?? []) {
          if (tag) usage[tag] = usage[tag] ?? 1;
        }
      }
      cachedUsage = usage;
      return usage;
    })
    .catch(() => ({}))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Invalidate after checkout so PDP/cart can refresh claim state. */
export function invalidateFlashSaleClaimsCache() {
  cachedUsage = null;
}

export function useFlashSaleClaimUsage(saleTag: string | null | undefined): {
  used: number;
  loading: boolean;
} {
  const [used, setUsed] = useState(() =>
    saleTag && cachedUsage ? cachedUsage[saleTag] ?? 0 : 0
  );
  const [loading, setLoading] = useState(Boolean(saleTag) && !cachedUsage);

  useEffect(() => {
    if (!saleTag) {
      setUsed(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(!cachedUsage);
    void fetchClaimUsage().then((usage) => {
      if (cancelled) return;
      setUsed(usage[saleTag] ?? 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [saleTag]);

  return { used, loading };
}

export function useFlashSaleClaimed(
  saleTag: string | null | undefined,
  purchaseLimit?: number | null
): {
  claimed: boolean;
  loading: boolean;
} {
  const { used, loading } = useFlashSaleClaimUsage(saleTag);
  const limit = purchaseLimit ?? 0;
  const claimed = Boolean(saleTag) && limit > 0 && used >= limit;
  return { claimed, loading };
}
