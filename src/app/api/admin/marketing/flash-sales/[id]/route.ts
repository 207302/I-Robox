import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

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
    const body = parsed.body;
    const current = await prisma.flash_sale_products.findUnique({
      where: { id },
      select: { product_id: true },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const data: Record<string, unknown> = {};
    if (body.sale_price !== undefined) {
      const n = Number(body.sale_price);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid sale_price" }, { status: 400 });
      }
      const product = await prisma.products.findUnique({
        where: { id: current.product_id },
        select: { base_price: true, discounted_price: true },
      });
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      const listedPrice = Number(product.discounted_price ?? product.base_price);
      if (!(n < listedPrice)) {
        return NextResponse.json(
          { error: `Flash sale price must be lower than listed price (₹${listedPrice})` },
          { status: 400 }
        );
      }
      data.sale_price = n;
    }
    if (typeof body.is_active === "boolean") data.is_active = body.is_active;
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
  
    await prisma.flash_sale_products.update({ where: { id }, data });
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

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
  
    await prisma.flash_sale_products.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
