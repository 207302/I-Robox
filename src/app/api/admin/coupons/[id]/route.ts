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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const coupon = await prisma.coupons.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        discount_type: true,
        discount_value: true,
        min_cart_value: true,
        max_uses: true,
        max_uses_per_user: true,
        starts_at: true,
        ends_at: true,
        is_active: true,
        coupon_categories: { select: { category_id: true } },
        coupon_brands: { select: { brand_id: true } },
        coupon_products: { select: { product_id: true } },
      },
    });
    if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { coupon_categories, coupon_brands, coupon_products, ...rest } = coupon;
    return NextResponse.json(
      {
        ...rest,
        category_ids: coupon_categories.map((c) => c.category_id),
        brand_ids: coupon_brands.map((b) => b.brand_id),
        product_ids: coupon_products.map((p) => p.product_id),
      },
      { status: 200 }
    );
  
  });}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_coupons_put:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    let code: string | undefined;
    if (body.code !== undefined) {
      if (typeof body.code !== "string") {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }
      code = normalizeCode(body.code);
      if (!code || hasSuspiciousInput(code)) {
        return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
      }
    }
  
    let discount_type: string | undefined;
    if (body.discount_type !== undefined) {
      if (typeof body.discount_type !== "string") {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }
      const dt = cleanText(body.discount_type, 30);
      if (!isAllowedCouponDiscountType(dt)) {
        return NextResponse.json({ error: "Invalid discount type" }, { status: 400 });
      }
      discount_type = dt;
    }
  
    const starts_at =
      body.starts_at !== undefined
        ? body.starts_at === null || body.starts_at === ""
          ? null
          : new Date(String(body.starts_at))
        : undefined;
    const ends_at =
      body.ends_at !== undefined
        ? body.ends_at === null || body.ends_at === ""
          ? null
          : new Date(String(body.ends_at))
        : undefined;
    if (starts_at !== undefined && starts_at !== null && Number.isNaN(starts_at.getTime())) {
      return NextResponse.json({ error: "Invalid starts_at" }, { status: 400 });
    }
    if (ends_at !== undefined && ends_at !== null && Number.isNaN(ends_at.getTime())) {
      return NextResponse.json({ error: "Invalid ends_at" }, { status: 400 });
    }
  
    let max_uses: number | null | undefined;
    if (body.max_uses !== undefined) {
      max_uses = body.max_uses === null || body.max_uses === "" ? null : Number(body.max_uses);
      if (max_uses !== null && !Number.isFinite(max_uses)) {
        return NextResponse.json({ error: "Invalid max_uses" }, { status: 400 });
      }
    }
    let max_uses_per_user: number | null | undefined;
    if (body.max_uses_per_user !== undefined) {
      max_uses_per_user =
        body.max_uses_per_user === null || body.max_uses_per_user === ""
          ? null
          : Number(body.max_uses_per_user);
      if (max_uses_per_user !== null && !Number.isFinite(max_uses_per_user)) {
        return NextResponse.json({ error: "Invalid max_uses_per_user" }, { status: 400 });
      }
    }
  
    await prisma.$transaction(async (tx) => {
      await tx.coupons.update({
        where: { id },
        data: {
          code,
          discount_type,
          discount_value: body.discount_value !== undefined ? Number(body.discount_value) : undefined,
          min_cart_value:
            body.min_cart_value !== undefined
              ? body.min_cart_value === "" || body.min_cart_value === null
                ? null
                : Number(body.min_cart_value)
              : undefined,
          is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
          starts_at,
          ends_at,
          max_uses,
          max_uses_per_user,
        },
      });
  
      if (Array.isArray(body.category_ids)) {
        const catIds = body.category_ids.filter(
          (x: unknown) => typeof x === "string" && isUuid(x)
        ) as string[];
        await tx.coupon_categories.deleteMany({ where: { coupon_id: id } });
        if (catIds.length) {
          await tx.coupon_categories.createMany({
            data: catIds.map((category_id) => ({ coupon_id: id, category_id })),
          });
        }
      }

      if (Array.isArray(body.brand_ids)) {
        const brandIds = body.brand_ids.filter(
          (x: unknown) => typeof x === "string" && isUuid(x)
        ) as string[];
        await tx.coupon_brands.deleteMany({ where: { coupon_id: id } });
        if (brandIds.length) {
          await tx.coupon_brands.createMany({
            data: brandIds.map((brand_id) => ({ coupon_id: id, brand_id })),
          });
        }
      }

      if (Array.isArray(body.product_ids)) {
        const productIds = body.product_ids.filter(
          (x: unknown) => typeof x === "string" && isUuid(x)
        ) as string[];
        await tx.coupon_products.deleteMany({ where: { coupon_id: id } });
        if (productIds.length) {
          await tx.coupon_products.createMany({
            data: productIds.map((product_id) => ({ coupon_id: id, product_id })),
          });
        }
      }
    });
  
    return NextResponse.json({ ok: true, id }, { status: 200 });
  
  });}

