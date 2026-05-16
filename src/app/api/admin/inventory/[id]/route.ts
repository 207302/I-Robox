import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await prisma.inventory.findUnique({
      where: { id },
      select: {
        id: true,
        available_quantity: true,
        low_stock_threshold: true,
        products: { select: { name: true } },
      },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      {
        id: row.id,
        productName: row.products?.name ?? null,
        available_quantity: row.available_quantity,
        low_stock_threshold: row.low_stock_threshold,
      },
      { status: 200 }
    );
  
  });}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_inventory_put:${req.ip ?? "unknown"}`, 1);
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
  
    const available = Number(body.available_quantity);
    const threshold = Number(body.low_stock_threshold);
    if (!Number.isInteger(available) || available < 0 || !Number.isInteger(threshold) || threshold < 0) {
      return NextResponse.json({ error: "Invalid quantities" }, { status: 400 });
    }
  
    const updated = await prisma.inventory.update({
      where: { id },
      data: { available_quantity: available, low_stock_threshold: threshold },
      select: { product_id: true },
    });
  
    await syncLowStockAlertsByProductIds([updated.product_id]).catch((err) => {
      console.error("[admin inventory PUT] low stock alert sync failed", err);
    });
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

