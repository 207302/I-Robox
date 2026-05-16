import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

export const dynamic = "force-dynamic";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.flash_sale_products.findMany({
      orderBy: { updated_at: "desc" },
      include: { products: { select: { id: true, name: true, slug: true } } },
    });
    const plain = rows.map((r) => ({ ...r, sale_price: Number(r.sale_price) }));
    return NextResponse.json(plain, {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
        pragma: "no-cache",
        expires: "0",
      },
    });
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_mflash_post:${req.ip ?? "unknown"}`, 1);
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
  
    const product_id = String(body.product_id ?? "");
    if (!isUuid(product_id)) return NextResponse.json({ error: "Invalid product_id" }, { status: 400 });
    const sale_price = Number(body.sale_price);
    if (!Number.isFinite(sale_price) || sale_price <= 0) {
      return NextResponse.json({ error: "Invalid sale_price" }, { status: 400 });
    }
    const is_active = Boolean(body.is_active);
    const active_from = parseOptionalDate(body.active_from);
    const active_until = parseOptionalDate(body.active_until);
  
    const product = await prisma.products.findUnique({
      where: { id: product_id },
      select: { id: true, base_price: true, discounted_price: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const listedPrice = Number(product.discounted_price ?? product.base_price);
    if (!(sale_price < listedPrice)) {
      return NextResponse.json(
        { error: `Flash sale price must be lower than listed price (₹${listedPrice})` },
        { status: 400 }
      );
    }
  
    const existing = await prisma.flash_sale_products.findUnique({
      where: { product_id },
      select: { id: true },
    });
  
    if (existing) {
      const updated = await prisma.flash_sale_products.update({
        where: { product_id },
        data: {
          sale_price,
          is_active,
          active_from: active_from ?? null,
          active_until: active_until ?? null,
        },
        include: { products: { select: { id: true, name: true, slug: true } } },
      });
      return NextResponse.json(
        { ok: true, id: updated.id, updated: true, item: { ...updated, sale_price: Number(updated.sale_price) } },
        { status: 200 }
      );
    }
  
    const created = await prisma.flash_sale_products.create({
      data: {
        product_id,
        sale_price,
        is_active,
        active_from: active_from ?? null,
        active_until: active_until ?? null,
      },
      include: { products: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json(
      { ok: true, id: created.id, created: true, item: { ...created, sale_price: Number(created.sale_price) } },
      { status: 201 }
    );
  
  });}
