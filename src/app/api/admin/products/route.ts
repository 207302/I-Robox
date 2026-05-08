import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaDB";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, hasSuspiciousInput, isUuid, readJsonBody } from "@/lib/validation/input";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { resolveProductTaxonomyForSave } from "@/lib/admin/productTaxonomy";

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

function parseShippingPerUnitIn(body: Record<string, unknown>): number | { error: string } {
  if (body.shipping_per_unit === undefined || body.shipping_per_unit === null || body.shipping_per_unit === "") {
    return 0;
  }
  const n = Number(body.shipping_per_unit);
  if (!Number.isFinite(n) || n < 0 || n > 50_000) return { error: "Invalid shipping_per_unit" };
  return Math.round(n * 100) / 100;
}

function parseMaxOrderQuantityIn(body: Record<string, unknown>): number | { error: string } {
  if (body.max_order_quantity === undefined || body.max_order_quantity === null || body.max_order_quantity === "") {
    return 99;
  }
  const n = Number(body.max_order_quantity);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return { error: "Invalid max_order_quantity" };
  return n;
}

type CreateVariantInput = {
  color: string;
  name: string | null;
  sku: string | null;
  is_default: boolean;
};

function parseVariantsIn(body: Record<string, unknown>): CreateVariantInput[] | { error: string } {
  if (body.variants === undefined || body.variants === null) return [];
  if (!Array.isArray(body.variants)) return { error: "Invalid variants payload" };
  if (body.variants.length > 50) return { error: "Too many variants" };

  const out: CreateVariantInput[] = [];
  const seenColors = new Set<string>();

  for (const row of body.variants) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { error: "Invalid variant row" };
    }
    const rec = row as Record<string, unknown>;
    const color = cleanText(rec.color, 80);
    if (!color) return { error: "Variant color is required" };
    if (hasSuspiciousInput(color)) return { error: "Invalid variant color" };
    const colorKey = color.toLowerCase();
    if (seenColors.has(colorKey)) return { error: `Duplicate variant color: ${color}` };
    seenColors.add(colorKey);

    const name = cleanOptionalText(rec.name, 255);
    const sku = cleanOptionalText(rec.sku, 120);
    const isDefault = Boolean(rec.is_default);
    out.push({ color, name, sku, is_default: isDefault });
  }

  if (out.length > 0 && !out.some((v) => v.is_default)) {
    out[0].is_default = true;
  } else if (out.length > 0) {
    let picked = false;
    for (const v of out) {
      if (!picked && v.is_default) {
        picked = true;
      } else {
        v.is_default = false;
      }
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await rateLimitStrict(`admin_products_post:${req.ip ?? "unknown"}`, 1);
  } catch (e: any) {
    if (e?.message === "BAD_ORIGIN") {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getAdminSession();
  if (!session || !isAllowed(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await readJsonBody(req);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const body = parsed.body;

  const name = cleanText(body.name, 255);
  const slug = cleanText(body.slug, 255);
  const base_price = Number(body.base_price);
  const discounted_price = body.discounted_price ? Number(body.discounted_price) : null;
  const sku = cleanOptionalText(body.sku, 100);
  const description = cleanOptionalText(body.description, 10000);
  const short_description = cleanOptionalText(body.short_description, 2000);
  const is_active = Boolean(body.is_active);
  const age_group = cleanOptionalText(body.age_group, 50);
  const diecast_scale_id = cleanOptionalText(body.diecast_scale_id, 64);
  const category_id = cleanOptionalText(body.category_id, 64);
  const brand_id = cleanOptionalText(body.brand_id, 64);
  const type_id_in = cleanOptionalText(body.type_id, 64);
  const subtype_id_in = cleanOptionalText(body.subtype_id, 64);
  const collection_id_in = cleanOptionalText(body.collection_id, 64);
  let hsn_code: string | null = null;
  if (body.hsn_code !== undefined && body.hsn_code !== null && body.hsn_code !== "") {
    if (typeof body.hsn_code !== "string") {
      return NextResponse.json({ error: "Invalid hsn_code" }, { status: 400 });
    }
    const h = body.hsn_code.replace(/\s/g, "").replace(/[^0-9,]/g, "").slice(0, 32);
    hsn_code = h || null;
  }
  const available_quantity = body.available_quantity !== undefined ? Math.max(0, Number(body.available_quantity)) : 0;
  const low_stock_threshold = body.low_stock_threshold !== undefined ? Math.max(0, Number(body.low_stock_threshold)) : 5;
  const shippingParsed = parseShippingPerUnitIn(body as Record<string, unknown>);
  if (typeof shippingParsed === "object") {
    return NextResponse.json({ error: shippingParsed.error }, { status: 400 });
  }
  const maxOrderQtyParsed = parseMaxOrderQuantityIn(body as Record<string, unknown>);
  if (typeof maxOrderQtyParsed === "object") {
    return NextResponse.json({ error: maxOrderQtyParsed.error }, { status: 400 });
  }
  const variantsParsed = parseVariantsIn(body as Record<string, unknown>);
  if (typeof variantsParsed === "object" && "error" in variantsParsed) {
    return NextResponse.json({ error: variantsParsed.error }, { status: 400 });
  }

  if (!name || !slug || !Number.isFinite(base_price)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (
    [name, slug, sku ?? "", age_group ?? "", description ?? "", short_description ?? ""].some((v) =>
      hasSuspiciousInput(v)
    )
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (
    (category_id && !isUuid(category_id)) ||
    (brand_id && !isUuid(brand_id)) ||
    (diecast_scale_id && !isUuid(diecast_scale_id)) ||
    (type_id_in && !isUuid(type_id_in)) ||
    (subtype_id_in && !isUuid(subtype_id_in)) ||
    (collection_id_in && !isUuid(collection_id_in))
  ) {
    return NextResponse.json({ error: "Invalid relations" }, { status: 400 });
  }

  try {
    const tax = await resolveProductTaxonomyForSave({
      category_id: category_id ?? null,
      type_id: type_id_in ?? null,
      subtype_id: subtype_id_in ?? null,
      collection_id: collection_id_in ?? null,
    });
    if ("error" in tax) {
      return NextResponse.json({ error: tax.error }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.products.create({
        data: {
          name,
          slug,
          base_price,
          discounted_price,
          shipping_per_unit: shippingParsed,
          max_order_quantity: maxOrderQtyParsed,
          sku,
          hsn_code,
          diecast_scale_id,
          description,
          short_description,
          is_active,
          age_group,
          category_id: tax.category_id,
          brand_id,
          type_id: tax.type_id,
          subtype_id: tax.subtype_id,
          collection_id: tax.collection_id,
        },
        select: { id: true },
      });

      await tx.inventory.create({
        data: {
          product_id: createdProduct.id,
          product_variant_id: null,
          available_quantity,
          reserved_quantity: 0,
          sold_quantity: 0,
          low_stock_threshold,
        },
      });

      if (variantsParsed.length > 0) {
        await tx.product_variants.createMany({
          data: variantsParsed.map((v) => ({
            product_id: createdProduct.id,
            color: v.color,
            name: v.name,
            sku: v.sku,
            is_default: v.is_default,
          })),
        });
      }

      return createdProduct;
    });

    await syncLowStockAlertsByProductIds([created.id]).catch((err) => {
      console.error("[admin products POST] low stock alert sync failed", err);
    });

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err: any) {
    const code = typeof err?.code === "string" ? err.code : "";
    const target = Array.isArray(err?.meta?.target)
      ? err.meta.target.join(",")
      : String(err?.meta?.target ?? "");

    if (code === "P2002" && target.toLowerCase().includes("slug")) {
      return NextResponse.json({ error: "Slug already exists. Please use a unique product name/slug." }, { status: 409 });
    }
    if (code === "P2002") {
      return NextResponse.json({ error: "A unique field already exists for this product." }, { status: 409 });
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "Invalid relation selected (category/brand/type/subtype/collection)." }, { status: 400 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Related record was not found." }, { status: 400 });
    }

    console.error("[admin products POST] unhandled error", err);
    return NextResponse.json({ error: "Could not create product. Check runtime logs for details." }, { status: 500 });
  }
}

