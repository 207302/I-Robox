import "server-only";

import { unstable_cache } from "next/cache";
import type { marketing_popups } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JwtPayload } from "@/lib/auth/jwt";
import {
  couponTimingError,
  couponUsageErrors,
  fetchCouponForCart,
} from "@/lib/coupons/cartCoupon";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  getFreeShippingExcludedCategoryIds,
  getFreeShippingThresholdInr,
} from "@/lib/marketing/freeShipping";
import { normalizeCode } from "@/lib/validation/input";
import type {
  MarketingPopupPayload,
  PublicMarketingPayload,
} from "@/lib/marketing/publicMarketingTypes";
import { MARKETING_TAG, POPUPS_TAG } from "@/lib/cache/tags";
import { getSiteMarketingSettings } from "@/lib/queries/marketing";

const PUBLIC_MARKETING_DATA_REVALIDATE_SECONDS = 300;

const getCachedMarketingPopupsForStorefront = unstable_cache(
  async () => {
    try {
      return await prisma.marketing_popups.findMany({
        orderBy: { sort_priority: "asc" },
      });
    } catch {
      return [];
    }
  },
  ["public-marketing-popups-storefront"],
  { revalidate: PUBLIC_MARKETING_DATA_REVALIDATE_SECONDS, tags: [POPUPS_TAG, MARKETING_TAG] }
);

function toPopupPayload(popup: marketing_popups): MarketingPopupPayload {
  return {
    id: popup.id,
    title: popup.title,
    body: popup.body,
    image_url: popup.image_url,
    cta_label: popup.cta_label,
    cta_url: popup.cta_url,
    delay_ms: popup.delay_ms,
    auto_close_ms: popup.auto_close_ms,
    frequency: popup.frequency,
    suggested_coupon_code: popup.suggested_coupon_code,
  };
}

/** Shared with GET /api/public/marketing and site layout hydration. */
export async function buildPublicMarketingPayload(
  session: JwtPayload | null,
  now: Date = new Date()
): Promise<PublicMarketingPayload> {
  const isLoggedIn = Boolean(session?.sub);

  const [settings, freeShippingThresholdInr, freeShippingExcludedCategoryIds, popups] =
    await Promise.all([
      getSiteMarketingSettings(),
      getFreeShippingThresholdInr(),
      getFreeShippingExcludedCategoryIds(),
      getCachedMarketingPopupsForStorefront(),
    ]);

  let firstVisitCouponCode: string | null = null;
  const rawFirst = settings?.first_visit_coupon_code?.trim();
  if (rawFirst) {
    const code = normalizeCode(rawFirst);
    const c = code ? await fetchCouponForCart(code) : null;
    if (c) {
      const t = couponTimingError(c, now);
      const u = await couponUsageErrors(c, session?.sub ?? null);
      if (!t && !u) {
        if (session?.sub) {
          const usedFirstVisit = await prisma.coupon_usages.count({
            where: { coupon_id: c.id, customer_id: session.sub },
          });
          if (usedFirstVisit === 0) firstVisitCouponCode = c.code;
        } else {
          firstVisitCouponCode = c.code;
        }
      }
    }
  }

  const activePopups = popups.filter((p) =>
    isActiveInWindow(p.is_active, p.active_from, p.active_until, now)
  );
  const matched = activePopups.filter((p) => {
    if (p.audience === "ALL") return true;
    if (p.audience === "GUESTS_ONLY") return !isLoggedIn;
    if (p.audience === "LOGGED_IN_ONLY") return isLoggedIn;
    return true;
  });
  const popup = matched[0] ?? null;

  return {
    popup: popup ? toPopupPayload(popup) : null,
    firstVisitCouponCode,
    freeShippingThresholdInr,
    freeShippingExcludedCategoryIds,
  };
}

export async function getPublicMarketingPayload(
  session: JwtPayload | null
): Promise<PublicMarketingPayload> {
  return buildPublicMarketingPayload(session);
}

/** Guest storefront marketing (no cookies) — safe for ISR layouts. */
export const getGuestPublicMarketingPayload = unstable_cache(
  () => buildPublicMarketingPayload(null),
  ["guest-public-marketing-payload"],
  {
    revalidate: PUBLIC_MARKETING_DATA_REVALIDATE_SECONDS,
    tags: [MARKETING_TAG, POPUPS_TAG],
  }
);
