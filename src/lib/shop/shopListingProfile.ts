import { getPerfContext, profiledSpan } from "@/lib/observability/context";

/** Set `SHOP_LISTING_PROFILE=1` to log Prisma op count and per-step timings. */
export type ShopListingProfile = {
  prismaOps: number;
  startedAt: number;
  spans: { label: string; ms: number }[];
};

export function createShopListingProfile(): ShopListingProfile {
  return { prismaOps: 0, startedAt: Date.now(), spans: [] };
}

export async function profiledQuery<T>(
  profile: ShopListingProfile,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (getPerfContext()) {
    return profiledSpan(label, fn);
  }
  profile.prismaOps += 1;
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    profile.spans.push({ label, ms: Date.now() - t0 });
  }
}

export function finishShopListingProfile(profile: ShopListingProfile, extra?: Record<string, unknown>) {
  if (process.env.SHOP_LISTING_PROFILE !== "1") return;
  const elapsedMs = Date.now() - profile.startedAt;
  console.info("[shopListing] profile", {
    prismaOps: profile.prismaOps,
    elapsedMs,
    topSlowest: [...profile.spans].sort((a, b) => b.ms - a.ms).slice(0, 8),
    ...extra,
  });
}
