"use client";

import { useEffect, useState } from "react";

let cachedTags: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

async function fetchClaimedTags(): Promise<Set<string>> {
  if (cachedTags) return cachedTags;
  if (inflight) return inflight;
  inflight = fetch("/api/flash-sale/my-claims", { credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) return new Set<string>();
      const data = (await res.json()) as { tags?: string[] };
      const tags = new Set((data.tags ?? []).filter(Boolean));
      cachedTags = tags;
      return tags;
    })
    .catch(() => new Set<string>())
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Invalidate after checkout so PDP/cart can refresh claim state. */
export function invalidateFlashSaleClaimsCache() {
  cachedTags = null;
}

export function useFlashSaleClaimed(saleTag: string | null | undefined): {
  claimed: boolean;
  loading: boolean;
} {
  const [claimed, setClaimed] = useState(() =>
    saleTag && cachedTags ? cachedTags.has(saleTag) : false
  );
  const [loading, setLoading] = useState(Boolean(saleTag) && !cachedTags);

  useEffect(() => {
    if (!saleTag) {
      setClaimed(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(!cachedTags);
    void fetchClaimedTags().then((tags) => {
      if (cancelled) return;
      setClaimed(tags.has(saleTag));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [saleTag]);

  return { claimed, loading };
}
