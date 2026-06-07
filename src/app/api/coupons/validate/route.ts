import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeSiteMarketingSettingsFindUnique } from "@/lib/db/safeReads";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { hasSuspiciousInput, isUuid, normalizeCode, readJsonBody } from "@/lib/validation/input";
import {
  couponDiscountFromLines,
  couponTimingError,
  couponUsageErrors,
  fetchCouponForCart,
} from "@/lib/coupons/cartCoupon";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`coupon_validate:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getSession();
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const code = normalizeCode(body.code);
    const subtotal = Number(body.subtotal ?? 0);
    const rawLines = Array.isArray(body.lineItems) ? body.lineItems : [];
  
    if (!code) return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    if (hasSuspiciousInput(code)) {
      return NextResponse.json({ error: "Invalid coupon" }, { status: 400 });
    }
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return NextResponse.json({ error: "Invalid subtotal" }, { status: 400 });
    }
  
    const coupon = await fetchCouponForCart(code);
  
    if (!coupon) return NextResponse.json({ error: "Invalid coupon" }, { status: 404 });
  
    const now = new Date();
    const timeErr = couponTimingError(coupon, now);
    if (timeErr) return NextResponse.json({ error: timeErr }, { status: 400 });
  
    const parsedLines: { productId: string; subtotal: number }[] = [];
    for (const row of rawLines) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { productId?: unknown; subtotal?: unknown; quantity?: unknown };
      const pid = rec.productId;
      if (typeof pid !== "string" || !isUuid(pid)) continue;
      const lineSubtotal = Number(rec.subtotal);
      parsedLines.push({
        productId: pid,
        subtotal:
          Number.isFinite(lineSubtotal) && lineSubtotal > 0
            ? lineSubtotal
            : subtotal / Math.max(1, rawLines.length),
      });
    }

    if (parsedLines.length === 0) {
      return NextResponse.json(
        {
          error:
            "This coupon applies to specific products, categories, or brands — add items to your cart to validate",
        },
        { status: 400 }
      );
    }

    const productIds = [...new Set(parsedLines.map((line) => line.productId))];
    const products = await prisma.products.findMany({
      where: { id: { in: productIds }, is_active: true },
      select: { id: true, category_id: true, brand_id: true },
    });
    const pmap = new Map(products.map((p) => [p.id, p]));
    const couponLines = parsedLines.map((line) => {
      const p = pmap.get(line.productId);
      return {
        productId: line.productId,
        categoryId: p?.category_id ?? null,
        brandId: p?.brand_id ?? null,
        subtotal: line.subtotal,
      };
    });

    const usageErr = await couponUsageErrors(coupon, session?.sub ?? null);
    if (usageErr) return NextResponse.json({ error: usageErr }, { status: 400 });
  
    // Extra guard for first-visit coupon on logged-in users.
    if (session?.sub) {
      const settings = await safeSiteMarketingSettingsFindUnique({
        where: { id: SITE_MARKETING_SETTINGS_ID },
        select: { first_visit_coupon_code: true },
      });
      const firstVisitCode = (settings?.first_visit_coupon_code ?? "").trim().toUpperCase();
      if (firstVisitCode && coupon.code.toUpperCase() === firstVisitCode) {
        const usedFirstVisit = await prisma.coupon_usages.count({
          where: { coupon_id: coupon.id, customer_id: session.sub },
        });
        if (usedFirstVisit > 0) {
          return NextResponse.json(
            { error: "First-visit offer already used for this email" },
            { status: 400 }
          );
        }
      }
    }
  
    const { discount, error: discountErr } = couponDiscountFromLines(couponLines, coupon);
    if (discountErr) return NextResponse.json({ error: discountErr }, { status: 400 });
  
    return NextResponse.json({
      ok: true,
      coupon: { code: coupon.code },
      discount,
      total: Math.max(0, subtotal - discount),
    });
  
  });}

