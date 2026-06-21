import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { runApiRoute } from "@/lib/api/runApiRoute";
import {
  cleanText,
  hasSuspiciousInput,
  isAllowedCouponDiscountType,
  isUuid,
  normalizeCode,
  readJsonBody,
} from "@/lib/validation/input";
import {
  validateCouponDiscount,
  validateNonNegativeNumber,
  validatePositiveInt,
} from "@/lib/validation/rules";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_coupons_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const code = normalizeCode(body.code);
    const discount_type = cleanText(body.discount_type ?? "PERCENTAGE", 30);
    const discountValueRaw = Number(body.discount_value);

    if (!code) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }
    if (hasSuspiciousInput(code)) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }
    if (!isAllowedCouponDiscountType(discount_type)) {
      return NextResponse.json({ error: "Invalid discount type" }, { status: 400 });
    }
    const discountResult = validateCouponDiscount(discount_type, discountValueRaw);
    if (!discountResult.ok) {
      return NextResponse.json({ error: discountResult.error }, { status: 400 });
    }
    const discount_value = discountResult.value;

    let min_cart_value: number | null = null;
    if (body.min_cart_value != null && body.min_cart_value !== "") {
      const minResult = validateNonNegativeNumber(body.min_cart_value, 10_000_000, "minimum cart value");
      if (!minResult.ok) return NextResponse.json({ error: minResult.error }, { status: 400 });
      min_cart_value = minResult.value;
    }

    let max_uses: number | null = null;
    if (body.max_uses != null && body.max_uses !== "") {
      const maxResult = validatePositiveInt(body.max_uses, 1_000_000, "max uses");
      if (!maxResult.ok) return NextResponse.json({ error: maxResult.error }, { status: 400 });
      max_uses = maxResult.value;
    }

    let max_uses_per_user: number | null = null;
    if (body.max_uses_per_user != null && body.max_uses_per_user !== "") {
      const perUserResult = validatePositiveInt(body.max_uses_per_user, 1000, "max uses per user");
      if (!perUserResult.ok) return NextResponse.json({ error: perUserResult.error }, { status: 400 });
      max_uses_per_user = perUserResult.value;
    }

    const starts_at = body.starts_at ? new Date(String(body.starts_at)) : null;
    const ends_at = body.ends_at ? new Date(String(body.ends_at)) : null;
    if (starts_at && Number.isNaN(starts_at.getTime())) {
      return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    }
    if (ends_at && Number.isNaN(ends_at.getTime())) {
      return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
    }
    if (starts_at && ends_at && ends_at < starts_at) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }
    const is_active = Boolean(body.is_active);
  
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.coupons.create({
        data: {
          code,
          discount_type,
          discount_value,
          min_cart_value,
          max_uses,
          max_uses_per_user,
          starts_at,
          ends_at,
          is_active,
          applies_to_shipping: false,
        },
        select: { id: true },
      });
      if (Array.isArray(body.category_ids)) {
        const catIds = body.category_ids.filter(
          (x: unknown) => typeof x === "string" && isUuid(x)
        ) as string[];
        if (catIds.length) {
          await tx.coupon_categories.createMany({
            data: catIds.map((category_id) => ({ coupon_id: row.id, category_id })),
          });
        }
      }
      if (Array.isArray(body.brand_ids)) {
        const brandIds = body.brand_ids.filter(
          (x: unknown) => typeof x === "string" && isUuid(x)
        ) as string[];
        if (brandIds.length) {
          await tx.coupon_brands.createMany({
            data: brandIds.map((brand_id) => ({ coupon_id: row.id, brand_id })),
          });
        }
      }
      if (Array.isArray(body.product_ids)) {
        const productIds = body.product_ids.filter(
          (x: unknown) => typeof x === "string" && isUuid(x)
        ) as string[];
        if (productIds.length) {
          await tx.coupon_products.createMany({
            data: productIds.map((product_id) => ({ coupon_id: row.id, product_id })),
          });
        }
      }
      return row;
    });
  
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  
  });}

