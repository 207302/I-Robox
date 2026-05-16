import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { hasSuspiciousInput, isUuid, normalizeCode, readJsonBody } from "@/lib/validation/input";
import {
  categoryScopeError,
  computeCouponDiscount,
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
  
    if (coupon.categoryIds.length > 0) {
      const idList: string[] = [];
      for (const row of rawLines) {
        if (row && typeof row === "object") {
          const pid = (row as { productId?: unknown }).productId;
          if (typeof pid === "string" && isUuid(pid)) idList.push(pid);
        }
      }
      const productIds = [...new Set(idList)];
      if (productIds.length === 0) {
        return NextResponse.json(
          { error: "This coupon applies to specific categories — add items to your cart to validate" },
          { status: 400 }
        );
      }
      const products = await prisma.products.findMany({
        where: { id: { in: productIds }, is_active: true },
        select: { id: true, category_id: true },
      });
      const pmap = new Map(products.map((p) => [p.id, p.category_id]));
      const lineMeta = productIds.map((id) => ({
        productId: id,
        categoryId: pmap.get(id) ?? null,
      }));
      const scopeErr = categoryScopeError(coupon.categoryIds, lineMeta);
      if (scopeErr) return NextResponse.json({ error: scopeErr }, { status: 400 });
    }
  
    if (coupon.min_cart_value != null && subtotal < coupon.min_cart_value) {
      return NextResponse.json({ error: "Coupon minimum not met" }, { status: 400 });
    }
  
    const usageErr = await couponUsageErrors(coupon, session?.sub ?? null);
    if (usageErr) return NextResponse.json({ error: usageErr }, { status: 400 });
  
    // Extra guard for first-visit coupon on logged-in users.
    if (session?.sub) {
      const settings = await prisma.site_marketing_settings.findUnique({
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
  
    const discount = computeCouponDiscount(subtotal, coupon);
  
    return NextResponse.json({
      ok: true,
      coupon: { code: coupon.code },
      discount,
      total: Math.max(0, subtotal - discount),
    });
  
  });}

