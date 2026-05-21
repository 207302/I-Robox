import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { flashSalePriceMap, unitPriceWithFlashSale } from "@/lib/pricing/flashSale";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

type SyncItem = { productId: string; quantity: number };

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(`cart_sync:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      await rateLimitStorefront(`cart_sync:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const rawItems = Array.isArray(parsed.body.items) ? parsed.body.items : [];
    const items: SyncItem[] = [];
    for (const row of rawItems) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const rec = row as Record<string, unknown>;
      const productId = cleanText(rec.productId, 64);
      const quantity = Number(rec.quantity ?? 0);
      if (!productId || !isUuid(productId)) continue;
      if (!Number.isInteger(quantity) || quantity <= 0) continue;
      items.push({ productId, quantity });
    }
  
    await prisma.$transaction(async (tx) => {
      let cart = await tx.carts.findFirst({
        where: { customer_id: session.sub, status: "ACTIVE" },
        select: { id: true },
      });
      if (!cart && items.length === 0) return;
  
      if (!cart) {
        cart = await tx.carts.create({
          data: { customer_id: session.sub, status: "ACTIVE" },
          select: { id: true },
        });
      }
  
      await tx.cart_items.deleteMany({ where: { cart_id: cart.id } });
  
      if (items.length === 0) {
        await tx.carts.update({
          where: { id: cart.id },
          data: { abandoned_reminder_sent_at: null, updated_at: new Date() },
        });
        return;
      }
  
      const productIds = [...new Set(items.map((i) => i.productId))];
      const products = await tx.products.findMany({
        where: { id: { in: productIds }, is_active: true },
        select: { id: true, base_price: true, discounted_price: true },
      });
      const flashMap = await flashSalePriceMap(productIds);
      const priceById = new Map<string, number>();
      for (const p of products) {
        const base = Number(p.base_price);
        const disc = p.discounted_price != null ? Number(p.discounted_price) : null;
        const catalog = disc ?? base;
        const unit = unitPriceWithFlashSale(catalog, p.id, flashMap);
        priceById.set(p.id, unit);
      }
  
      const rows = items
        .filter((i) => priceById.has(i.productId))
        .map((i) => ({
          cart_id: cart!.id,
          product_id: i.productId,
          product_variant_id: null as string | null,
          quantity: i.quantity,
          unit_price: priceById.get(i.productId)!,
        }));
  
      if (rows.length > 0) {
        await tx.cart_items.createMany({ data: rows });
      }
  
      await tx.carts.update({
        where: { id: cart.id },
        data: { abandoned_reminder_sent_at: null, updated_at: new Date() },
      });
    });
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
