import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { resolveProductTaxonomyForSave } from "@/lib/admin/productTaxonomy";
import { v2 as cloudinary } from "cloudinary";
import { runApiRoute } from "@/lib/api/runApiRoute";

function parseShippingPerUnitIn(body: Record<string, unknown>): number | { error: string } | undefined {
  if (body.shipping_per_unit === undefined) return undefined;
  if (body.shipping_per_unit === null || body.shipping_per_unit === "") return 0;
  const n = Number(body.shipping_per_unit);
  if (!Number.isFinite(n) || n < 0 || n > 50_000) return { error: "Invalid shipping_per_unit" };
  return Math.round(n * 100) / 100;
}

function parseMaxOrderQuantityIn(body: Record<string, unknown>): number | { error: string } | undefined {
  if (body.max_order_quantity === undefined) return undefined;
  if (body.max_order_quantity === null || body.max_order_quantity === "") return 99;
  const n = Number(body.max_order_quantity);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return { error: "Invalid max_order_quantity" };
  return n;
}

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryPublicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = u.pathname.slice(idx + marker.length);
    tail = tail.replace(/^([^/]+\/)*v\d+\//, "");
    if (!tail) return null;
    return tail.replace(/\.[^.\/]+$/, "");
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const product = await prisma.products.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        base_price: true,
        discounted_price: true,
        shipping_per_unit: true,
        max_order_quantity: true,
        sku: true,
        hsn_code: true,
        description: true,
        short_description: true,
        is_active: true,
        age_group: true,
        diecast_scale_id: true,
        category_id: true,
        type_id: true,
        subtype_id: true,
        collection_id: true,
        brand_id: true,
        product_images: {
          where: { product_variant_id: null },
          orderBy: { sort_order: "asc" },
          select: { id: true, url: true, alt_text: true, sort_order: true },
        },
        product_variants: {
          orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
          select: {
            id: true,
            color: true,
            name: true,
            sku: true,
            is_default: true,
            product_images: {
              orderBy: { sort_order: "asc" },
              select: { id: true, url: true, sort_order: true },
            },
          },
        },
        inventory: {
          take: 1,
          where: { product_variant_id: null },
          select: { id: true, available_quantity: true, low_stock_threshold: true },
        },
      },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const inv = product.inventory[0] ?? null;
    return NextResponse.json({
      ...product,
      inventory: undefined,
      inventoryId: inv?.id ?? null,
      available_quantity: inv?.available_quantity ?? 0,
      low_stock_threshold: inv?.low_stock_threshold ?? 5,
    });
  
  });}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_products_put:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const bad = () => NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const data: Prisma.productsUncheckedUpdateInput = {};
  
    if (body.name !== undefined) {
      if (typeof body.name !== "string") return bad();
      const name = cleanText(body.name, 255);
      if (!name || hasSuspiciousInput(name)) return bad();
      data.name = name;
    }
    if (body.slug !== undefined) {
      if (typeof body.slug !== "string") return bad();
      const slug = cleanText(body.slug, 255);
      if (!slug || hasSuspiciousInput(slug)) return bad();
      data.slug = slug;
    }
    if (body.sku !== undefined) {
      if (body.sku !== null && typeof body.sku !== "string") return bad();
      const sku = cleanOptionalText(body.sku, 100);
      if (sku && hasSuspiciousInput(sku)) return bad();
      data.sku = sku;
    }
    if (body.hsn_code !== undefined) {
      if (body.hsn_code !== null && typeof body.hsn_code !== "string") return bad();
      if (body.hsn_code === null || body.hsn_code === "") {
        data.hsn_code = null;
      } else {
        const h = String(body.hsn_code).replace(/\s/g, "").replace(/[^0-9,]/g, "").slice(0, 32);
        data.hsn_code = h || null;
      }
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== "string") return bad();
      const description = cleanOptionalText(body.description, 10000);
      if (hasSuspiciousInput(description ?? "")) return bad();
      data.description = description;
    }
    if (body.short_description !== undefined) {
      if (body.short_description !== null && typeof body.short_description !== "string") return bad();
      const short_description = cleanOptionalText(body.short_description, 2000);
      if (hasSuspiciousInput(short_description ?? "")) return bad();
      data.short_description = short_description;
    }
    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") return bad();
      data.is_active = body.is_active;
    }
    if (body.age_group !== undefined) {
      if (body.age_group !== null && typeof body.age_group !== "string") return bad();
      const age_group = cleanOptionalText(body.age_group, 50);
      if (age_group && hasSuspiciousInput(age_group)) return bad();
      data.age_group = age_group;
    }
    if (body.diecast_scale_id !== undefined) {
      if (body.diecast_scale_id === null || body.diecast_scale_id === "") {
        data.diecast_scale_id = null;
      } else if (typeof body.diecast_scale_id === "string" && isUuid(cleanText(body.diecast_scale_id, 64))) {
        data.diecast_scale_id = cleanText(body.diecast_scale_id, 64);
      } else {
        return bad();
      }
    }
    const bodyAny = body as {
      category_id?: unknown;
      type_id?: unknown;
      subtype_id?: unknown;
      collection_id?: unknown;
    };
    const hasTaxOrCat =
      bodyAny.category_id !== undefined ||
      bodyAny.type_id !== undefined ||
      bodyAny.subtype_id !== undefined ||
      bodyAny.collection_id !== undefined;
    if (hasTaxOrCat) {
      const current = await prisma.products.findUnique({
        where: { id },
        select: { category_id: true, type_id: true, subtype_id: true, collection_id: true },
      });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const uuidOrNull = (v: unknown): { ok: true; value: string | null } | { ok: false } => {
        if (v === null || v === "" || v === undefined) return { ok: true, value: null };
        if (typeof v === "string" && isUuid(cleanText(v, 64))) {
          return { ok: true, value: cleanText(v, 64) };
        }
        return { ok: false };
      };
      let nextCategory = current.category_id;
      if (bodyAny.category_id !== undefined) {
        const c = uuidOrNull(bodyAny.category_id);
        if (!c.ok) return bad();
        nextCategory = c.value;
      }
      let nextType = current.type_id;
      if (bodyAny.type_id !== undefined) {
        const t = uuidOrNull(bodyAny.type_id);
        if (!t.ok) return bad();
        nextType = t.value;
      }
      let nextSubtype = current.subtype_id;
      if (bodyAny.subtype_id !== undefined) {
        const s = uuidOrNull(bodyAny.subtype_id);
        if (!s.ok) return bad();
        nextSubtype = s.value;
      }
      let nextCollection = current.collection_id;
      if (bodyAny.collection_id !== undefined) {
        const c = uuidOrNull(bodyAny.collection_id);
        if (!c.ok) return bad();
        nextCollection = c.value;
      }
      const resolved = await resolveProductTaxonomyForSave({
        category_id: nextCategory,
        type_id: nextType,
        subtype_id: nextSubtype,
        collection_id: nextCollection,
      });
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      data.category_id = resolved.category_id;
      data.type_id = resolved.type_id;
      data.subtype_id = resolved.subtype_id;
      data.collection_id = resolved.collection_id;
    }
    if (body.brand_id !== undefined) {
      if (body.brand_id === null || body.brand_id === "") {
        data.brand_id = null;
      } else if (typeof body.brand_id === "string" && isUuid(cleanText(body.brand_id, 64))) {
        data.brand_id = cleanText(body.brand_id, 64);
      } else {
        return bad();
      }
    }
    if (body.base_price !== undefined) {
      const n = Number(body.base_price);
      if (!Number.isFinite(n)) return bad();
      data.base_price = n;
    }
    if (body.discounted_price !== undefined) {
      if (body.discounted_price === "" || body.discounted_price === null) {
        data.discounted_price = null;
      } else {
        const n = Number(body.discounted_price);
        if (!Number.isFinite(n)) return bad();
        data.discounted_price = n;
      }
    }
    if (body.shipping_per_unit !== undefined) {
      const sp = parseShippingPerUnitIn(body as Record<string, unknown>);
      if (typeof sp === "object" && sp && "error" in sp) return NextResponse.json({ error: sp.error }, { status: 400 });
      if (typeof sp === "number") data.shipping_per_unit = sp;
    }
    if (body.max_order_quantity !== undefined) {
      const mq = parseMaxOrderQuantityIn(body as Record<string, unknown>);
      if (typeof mq === "object" && mq && "error" in mq) return NextResponse.json({ error: mq.error }, { status: 400 });
      if (typeof mq === "number") data.max_order_quantity = mq;
    }
  
    let updatedId = id;
    if (Object.keys(data).length > 0) {
      const updated = await prisma.products.update({
        where: { id },
        data,
        select: { id: true },
      });
      updatedId = updated.id;
    } else {
      const exists = await prisma.products.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  
    // Update inventory row if quantity fields were sent
    const hasQty = body.available_quantity !== undefined || body.low_stock_threshold !== undefined;
    if (hasQty) {
      const inv = await prisma.inventory.findFirst({
        where: { product_id: id, product_variant_id: null },
        select: { id: true },
      });
      const data: Record<string, number> = {};
      if (body.available_quantity !== undefined) data.available_quantity = Math.max(0, Number(body.available_quantity));
      if (body.low_stock_threshold !== undefined) data.low_stock_threshold = Math.max(0, Number(body.low_stock_threshold));
  
      if (inv) {
        await prisma.inventory.update({ where: { id: inv.id }, data });
      } else {
        await prisma.inventory.create({
          data: {
            product_id: id,
            product_variant_id: null,
            available_quantity: data.available_quantity ?? 0,
            reserved_quantity: 0,
            sold_quantity: 0,
            low_stock_threshold: data.low_stock_threshold ?? 5,
          },
        });
      }
    }
  
    if (hasQty) {
      await syncLowStockAlertsByProductIds([id]).catch((err) => {
        console.error("[admin products PUT] low stock alert sync failed", err);
      });
    }
  
    return NextResponse.json({ ok: true, id: updatedId }, { status: 200 });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_products_delete:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const imageRows = await prisma.product_images.findMany({
      where: { product_id: id },
      select: { url: true },
    });
  
    const [orderItemsCount, activeOrderRefsCount, reviewsCount, returnsCount] = await Promise.all([
      prisma.order_items.count({ where: { product_id: id } }),
      prisma.order_items.count({
        where: {
          product_id: id,
          orders: {
            status: {
              in: ["PENDING", "CONFIRMED", "SHIPPED", "RETURN_REQUESTED", "RETURN_APPROVED"],
            },
          },
        },
      }),
      prisma.reviews.count({ where: { product_id: id } }),
      prisma.returns.count({
        where: {
          order_items: {
            product_id: id,
          },
        },
      }),
    ]);
  
    if (orderItemsCount > 0 || reviewsCount > 0 || returnsCount > 0) {
      const reasonParts: string[] = [];
      if (activeOrderRefsCount > 0) reasonParts.push(`${activeOrderRefsCount} active/pending order item(s)`);
      if (orderItemsCount > 0) reasonParts.push(`${orderItemsCount} total historical order item(s)`);
      if (reviewsCount > 0) reasonParts.push(`${reviewsCount} review(s)`);
      if (returnsCount > 0) reasonParts.push(`${returnsCount} return record(s)`);
      return NextResponse.json(
        {
          error: `Cannot delete this product because it is referenced by ${reasonParts.join(", ")}. You can set it inactive instead.`,
        },
        { status: 409 }
      );
    }
  
    try {
      await prisma.products.delete({ where: { id } });
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      if (code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Cannot delete this product because it has order/review references. Set it inactive instead.",
          },
          { status: 409 }
        );
      }
      throw e;
    }
  
    const publicIds = imageRows
      .map((r) => cloudinaryPublicIdFromUrl(r.url))
      .filter((v): v is string => Boolean(v));
    if (publicIds.length > 0) {
      cloudinary.api.delete_resources(publicIds, { resource_type: "image" }).catch(() => {});
    }
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
