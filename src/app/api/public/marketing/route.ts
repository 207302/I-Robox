import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaDB";
import { getSession } from "@/lib/auth/session";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import {
  couponTimingError,
  couponUsageErrors,
  fetchCouponForCart,
} from "@/lib/coupons/cartCoupon";
import { normalizeCode } from "@/lib/validation/input";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";

export async function GET() {
  const now = new Date();
  const session = await getSession();
  const isLoggedIn = Boolean(session?.sub);

  const [settings, freeShippingThresholdInr] = await Promise.all([
    prisma.site_marketing_settings.findUnique({
      where: { id: SITE_MARKETING_SETTINGS_ID },
      select: { first_visit_coupon_code: true },
    }),
    getFreeShippingThresholdInr(),
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

  const popups = await prisma.marketing_popups.findMany({
    where: { is_active: true },
    orderBy: { sort_priority: "asc" },
  });
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

  return NextResponse.json({
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
  });
}
