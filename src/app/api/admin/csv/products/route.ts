import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { readJsonBody, sanitizeCsvPayload } from "@/lib/validation/input";
import { slugFromProductName } from "@/utils/slugGenerate";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { upsertProductLevelInventory } from "@/lib/inventory/productLevelInventory";
import { ensureDiecastScaleId, ratioFromImportText } from "@/lib/products/ensureDiecastScale";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateProductCatalog, revalidateSitemap } from "@/lib/cache/revalidate";

function parseNonNegInt(value: unknown, defaultVal: number): number {
  if (value === undefined || value === null) return defaultVal;
  const t = String(value).trim();
  if (t === "") return defaultVal;
  const n = Math.floor(Number(t));
  return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

function parseCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: any = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_csv_products_post:${req.ip ?? "unknown"}`, 1);
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
    if (!body.csv) return NextResponse.json({ error: "csv is required" }, { status: 400 });
  
    const csvText = sanitizeCsvPayload(body.csv, 2_000_000);
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const header = lines.length > 0 ? lines[0].split(",").map((h) => h.trim()) : [];
    const hasDiecastCol = header.includes("diecast_scale");
    const hasHsnCol = header.includes("hsn_code");
    const hasShippingCol = header.includes("shipping_per_unit");
    const hasMaxOrderQtyCol = header.includes("max_order_quantity");
  
    const rows = parseCsv(csvText);
    let count = 0;
    const touchedProductIds: string[] = [];
  
    for (const r of rows) {
      const name = String(r.name ?? "").trim();
      let slug = String(r.slug ?? "").trim();
      if (!slug) slug = slugFromProductName(name);
      if (slug.length > 255) slug = slug.slice(0, 255);
      const base_price = Number(r.base_price);
      const discounted_price = r.discounted_price ? Number(r.discounted_price) : null;
      const sku = r.sku ? String(r.sku).trim() : null;
      const hsnRaw = hasHsnCol ? String(r.hsn_code ?? "").trim() : "";
      let hsn_code: string | null | undefined = undefined;
      if (hasHsnCol) {
        if (hsnRaw === "") hsn_code = null;
        else hsn_code = hsnRaw.replace(/\s/g, "").replace(/[^0-9,]/g, "").slice(0, 32) || null;
      }
      const is_active = String(r.is_active ?? "true").toLowerCase() !== "false";
      let shipping_per_unit: number | undefined = undefined;
      if (hasShippingCol) {
        const raw = String(r.shipping_per_unit ?? "").trim();
        if (raw === "") shipping_per_unit = 0;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0 || n > 50_000) continue;
          shipping_per_unit = Math.round(n * 100) / 100;
        }
      }
      let max_order_quantity: number | undefined = undefined;
      if (hasMaxOrderQtyCol) {
        const raw = String(r.max_order_quantity ?? "").trim();
        if (raw === "") max_order_quantity = 99;
        else {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 1 || n > 1000) continue;
          max_order_quantity = n;
        }
      }
      if (!name || !slug || !Number.isFinite(base_price)) continue;
  
      const available_quantity = parseNonNegInt(r.available_quantity, 0);
      const low_stock_threshold = parseNonNegInt(r.low_stock_threshold, 5);
  
      let diecast_scale_id: string | null | undefined = undefined;
      if (hasDiecastCol) {
        const raw = String(r.diecast_scale ?? "").trim();
        const ratio = ratioFromImportText(raw);
        if (raw !== "" && !ratio) continue;
        diecast_scale_id = ratio ? await ensureDiecastScaleId(prisma, ratio) : null;
      }
  
      const updatePayload = {
        name,
        base_price,
        discounted_price,
        sku,
        is_active,
        ...(hasDiecastCol ? { diecast_scale_id: diecast_scale_id ?? null } : {}),
        ...(hasHsnCol ? { hsn_code: hsn_code ?? null } : {}),
        ...(hasShippingCol && shipping_per_unit !== undefined ? { shipping_per_unit } : {}),
        ...(hasMaxOrderQtyCol && max_order_quantity !== undefined ? { max_order_quantity } : {}),
      };
      const createPayload = {
        name,
        slug,
        base_price,
        discounted_price,
        sku,
        is_active,
        diecast_scale_id: hasDiecastCol ? diecast_scale_id ?? null : null,
        ...(hasHsnCol ? { hsn_code: hsn_code ?? null } : {}),
        ...(hasShippingCol && shipping_per_unit !== undefined ? { shipping_per_unit } : {}),
        ...(hasMaxOrderQtyCol && max_order_quantity !== undefined ? { max_order_quantity } : {}),
      };
  
      const created = await prisma.products.upsert({
        where: { slug },
        update: updatePayload,
        create: createPayload,
        select: { id: true },
      });
  
      touchedProductIds.push(created.id);
  
      await upsertProductLevelInventory(created.id, { available_quantity, low_stock_threshold });
  
      count++;
    }
  
    await syncLowStockAlertsByProductIds(touchedProductIds).catch((err) => {
      console.error("[admin csv products POST] low stock alert sync failed", err);
    });

    revalidateProductCatalog();
    revalidateSitemap();
  
    return NextResponse.json({ ok: true, count }, { status: 200 });
  
  });}

