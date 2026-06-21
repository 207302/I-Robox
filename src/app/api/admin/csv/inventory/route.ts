import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { readJsonBody, sanitizeCsvPayload } from "@/lib/validation/input";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { upsertProductLevelInventory } from "@/lib/inventory/productLevelInventory";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

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

const CSV_IMPORT_TIMEOUT_MS = 120_000;

export async function POST(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_csv_inventory_post:${req.ip ?? "unknown"}`, 1);
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
  
    const rows = parseCsv(sanitizeCsvPayload(body.csv, 2_000_000));
    let count = 0;
    const touchedProductIds = new Set<string>();
  
    for (const r of rows) {
      const slug = String(r.product_slug ?? "").trim();
      const available = Number(r.available_quantity);
      const threshold = Number(r.low_stock_threshold ?? 0);
      if (!slug || !Number.isInteger(available) || available < 0 || !Number.isInteger(threshold) || threshold < 0) continue;
  
      const product = await prisma.products.findUnique({ where: { slug }, select: { id: true } });
      if (!product) continue;
      touchedProductIds.add(product.id);
  
      await upsertProductLevelInventory(product.id, {
        available_quantity: available,
        low_stock_threshold: threshold,
      });
  
      count++;
    }
  
    await syncLowStockAlertsByProductIds([...touchedProductIds]).catch((err) => {
      console.error("[admin csv inventory POST] low stock alert sync failed", err);
    });
  
    return NextResponse.json({ ok: true, count }, { status: 200 });
    },
    { timeoutMs: CSV_IMPORT_TIMEOUT_MS, name: "POST /api/admin/csv/inventory" }
  );
}

