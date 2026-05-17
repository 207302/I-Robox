import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import {
  couponTimingError,
  couponUsageErrors,
  fetchCouponForCart,
} from "@/lib/coupons/cartCoupon";
import { normalizeCode } from "@/lib/validation/input";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";
import { getMarketingPopups, getSiteMarketingSettings } from "@/lib/queries/marketing";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { privateResponseCacheHeaders } from "@/lib/api/httpCache";

/** Popup audience depends on session cookie — private browser cache only. */
const PUBLIC_MARKETING_CACHE_SECONDS = 60;

export async function GET() {
  return runApiRoute(
    async () => {
      const now = new Date();
      const session = await getSession();
      const isLoggedIn = Boolean(session?.sub);

      const [settings, freeShippingThresholdInr, popups] = await Promise.all([
        getSiteMarketingSettings(),
        getFreeShippingThresholdInr(),
        getMarketingPopups(),
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

      return NextResponse.json(
        {
          popup: popup
            ? {
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
              }
            : null,
          firstVisitCouponCode,
          freeShippingThresholdInr,
        },
        { headers: privateResponseCacheHeaders(PUBLIC_MARKETING_CACHE_SECONDS) }
      );
    },
    { name: "GET /api/public/marketing", timeoutMs: 15_000 }
  );
}
