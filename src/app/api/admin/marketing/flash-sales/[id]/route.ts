import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateFlashSales } from "@/lib/cache/revalidate";
import {
  flashSaleAdminInclude,
  parseFlashSaleBody,
  replaceFlashSaleScope,
  serializeFlashSaleRow,
} from "@/lib/admin/flashSaleBody";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_flash_patch:${req.ip ?? "unknown"}`, 1);
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
    const body = parsed.body as Record<string, unknown>;

    const existing = await prisma.flash_sales.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const hasScopeUpdate =
      body.product_ids !== undefined ||
      body.category_ids !== undefined ||
      body.brand_ids !== undefined;

    if (
      body.discount_type !== undefined ||
      body.discount_value !== undefined ||
      hasScopeUpdate
    ) {
      const merged = {
        name: body.name !== undefined ? body.name : existing.name,
        sale_tag: body.sale_tag !== undefined ? body.sale_tag : existing.sale_tag,
        limit_one_per_customer:
          body.limit_one_per_customer !== undefined
            ? body.limit_one_per_customer
            : existing.limit_one_per_customer,
        discount_type: body.discount_type ?? existing.discount_type,
        discount_value: body.discount_value ?? existing.discount_value,
        is_active: body.is_active !== undefined ? body.is_active : existing.is_active,
        active_from: body.active_from !== undefined ? body.active_from : existing.active_from,
        active_until: body.active_until !== undefined ? body.active_until : existing.active_until,
        product_ids: body.product_ids,
        category_ids: body.category_ids,
        brand_ids: body.brand_ids,
      };

      if (hasScopeUpdate) {
        const current = await prisma.flash_sales.findUnique({
          where: { id },
          include: {
            products: { select: { product_id: true } },
            categories: { select: { category_id: true } },
            brands: { select: { brand_id: true } },
          },
        });
        if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
        merged.product_ids = body.product_ids ?? current.products.map((p) => p.product_id);
        merged.category_ids = body.category_ids ?? current.categories.map((c) => c.category_id);
        merged.brand_ids = body.brand_ids ?? current.brands.map((b) => b.brand_id);
      } else {
        const current = await prisma.flash_sales.findUnique({
          where: { id },
          include: {
            products: { select: { product_id: true } },
            categories: { select: { category_id: true } },
            brands: { select: { brand_id: true } },
          },
        });
        merged.product_ids = current?.products.map((p) => p.product_id) ?? [];
        merged.category_ids = current?.categories.map((c) => c.category_id) ?? [];
        merged.brand_ids = current?.brands.map((b) => b.brand_id) ?? [];
      }

      const bodyParsed = parseFlashSaleBody(merged);
      if (!bodyParsed.ok) return NextResponse.json({ error: bodyParsed.error }, { status: 400 });
      const data = bodyParsed.data;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.flash_sales.update({
          where: { id },
          data: {
            name: data.name,
            sale_tag: data.sale_tag,
            limit_one_per_customer: data.limit_one_per_customer,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            is_active: data.is_active,
            active_from: data.active_from,
            active_until: data.active_until,
          },
        });
        await replaceFlashSaleScope(id, data, tx);
        return tx.flash_sales.findUniqueOrThrow({
          where: { id },
          include: flashSaleAdminInclude,
        });
      });

      await revalidateFlashSales();
      return NextResponse.json({ ok: true, item: serializeFlashSaleRow(updated) });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const nameRaw = body.name == null ? null : String(body.name).trim();
      data.name = nameRaw ? nameRaw.slice(0, 120) : null;
    }
    if (typeof body.is_active === "boolean") data.is_active = body.is_active;
    if (typeof body.limit_one_per_customer === "boolean") {
      data.limit_one_per_customer = body.limit_one_per_customer;
    }
    if (body.sale_tag !== undefined) {
      const tag =
        body.sale_tag === null || body.sale_tag === ""
          ? null
          : String(body.sale_tag).trim().slice(0, 80) || null;
      data.sale_tag = tag;
    }
    if (body.active_from !== undefined) {
      const d = parseOptionalDate(body.active_from);
      if (d === undefined && body.active_from !== null && body.active_from !== "") {
        return NextResponse.json({ error: "Invalid active_from" }, { status: 400 });
      }
      data.active_from = d ?? null;
    }
    if (body.active_until !== undefined) {
      const d = parseOptionalDate(body.active_until);
      if (d === undefined && body.active_until !== null && body.active_until !== "") {
        return NextResponse.json({ error: "Invalid active_until" }, { status: 400 });
      }
      data.active_until = d ?? null;
    }

    await prisma.flash_sales.update({ where: { id }, data });
    await revalidateFlashSales();
    return NextResponse.json({ ok: true }, { status: 200 });
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_flash_del:${req.ip ?? "unknown"}`, 1);
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

    await prisma.flash_sales.delete({ where: { id } });
    await revalidateFlashSales();
    return NextResponse.json({ ok: true }, { status: 200 });
  });
}
