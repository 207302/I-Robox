import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_product_variants_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id: productId } = await ctx.params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const color = cleanText(body.color, 80);
    if (!color || hasSuspiciousInput(color)) {
      return NextResponse.json({ error: "Variant color is required" }, { status: 400 });
    }
    const name = cleanOptionalText(body.name, 255);
    const sku = cleanOptionalText(body.sku, 120);
    const isDefault = Boolean(body.is_default);
  
    const productExists = await prisma.products.findUnique({ where: { id: productId }, select: { id: true } });
    if (!productExists) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  
    const dup = await prisma.product_variants.findFirst({
      where: { product_id: productId, color: { equals: color, mode: "insensitive" } },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json({ error: `Variant color "${color}" already exists` }, { status: 409 });
    }
  
    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.product_variants.updateMany({
          where: { product_id: productId },
          data: { is_default: false },
        });
      }
      const variant = await tx.product_variants.create({
        data: {
          product_id: productId,
          color,
          name,
          sku,
          is_default: isDefault,
        },
        select: { id: true, color: true, name: true, sku: true, is_default: true },
      });
      return variant;
    });
  
    return NextResponse.json(created, { status: 201 });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_product_variants_delete:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id: productId } = await ctx.params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const variantId = cleanText(req.nextUrl.searchParams.get("variantId"), 64);
    if (!variantId || !isUuid(variantId)) {
      return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
    }
  
    const variant = await prisma.product_variants.findFirst({
      where: { id: variantId, product_id: productId },
      select: { id: true, is_default: true },
    });
    if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  
    const refs = await Promise.all([
      prisma.cart_items.count({ where: { product_variant_id: variantId } }),
      prisma.order_items.count({ where: { product_variant_id: variantId } }),
      prisma.inventory_reservations.count({ where: { product_variant_id: variantId } }),
    ]);
    if (refs.some((c) => c > 0)) {
      return NextResponse.json({ error: "Variant cannot be deleted because it is used in cart/order history." }, { status: 409 });
    }
  
    await prisma.$transaction(async (tx) => {
      await tx.inventory.deleteMany({ where: { product_variant_id: variantId } });
      await tx.product_images.deleteMany({ where: { product_variant_id: variantId } });
      await tx.product_variants.delete({ where: { id: variantId } });
  
      if (variant.is_default) {
        const next = await tx.product_variants.findFirst({
          where: { product_id: productId },
          orderBy: { created_at: "asc" },
          select: { id: true },
        });
        if (next) {
          await tx.product_variants.update({ where: { id: next.id }, data: { is_default: true } });
        }
      }
    });
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_product_variants_patch:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id: productId } = await ctx.params;
    if (!isUuid(productId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const variantId = cleanText(body.variantId, 64);
    if (!variantId || !isUuid(variantId)) {
      return NextResponse.json({ error: "Invalid variant id" }, { status: 400 });
    }
    if (body.is_default !== true) {
      return NextResponse.json({ error: "Only is_default=true is supported" }, { status: 400 });
    }
  
    const variant = await prisma.product_variants.findFirst({
      where: { id: variantId, product_id: productId },
      select: { id: true },
    });
    if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  
    await prisma.$transaction(async (tx) => {
      await tx.product_variants.updateMany({
        where: { product_id: productId },
        data: { is_default: false },
      });
      await tx.product_variants.update({ where: { id: variantId }, data: { is_default: true } });
    });
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
