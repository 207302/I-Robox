import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { orderShippingBreakdownFromLines } from "@/lib/checkout/orderShipping";
import {
  getFreeShippingExcludedBrandIds,
  getFreeShippingThresholdInr,
} from "@/lib/marketing/freeShipping";
import { flashSalePriceMap, unitPriceWithFlashSale } from "@/lib/pricing/flashSale";
import { getCodEligibilityForProducts } from "@/lib/checkout/cod";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { MAX_CART_PREVIEW_ITEMS } from "@/lib/validation/rules";
import { normalizeCartItem } from "@/lib/cart/cartLine";
import type { CartItem } from "@/redux/features/cart-slice";

type PreviewItem = {
  productId: string;
  quantity: number;
  price?: number;
};

function previewItemFromBody(row: Record<string, unknown>): PreviewItem | null {
  const item = normalizeCartItem({
    id: String(row.id ?? row.productId ?? ""),
    productId: row.productId != null ? String(row.productId) : undefined,
    quantity: Number(row.quantity ?? 0),
    price: Number(row.price ?? 0),
    name: "",
    currency: "inr",
    image: "",
  } as CartItem);
  const productId = String(item.productId ?? "").trim();
  if (!isUuid(productId)) return null;
  const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  const price = Number(item.price ?? 0);
  return {
    productId,
    quantity,
    price: Number.isFinite(price) ? price : undefined,
  };
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`shipping_preview:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const rawItems = Array.isArray(parsed.body.items) ? parsed.body.items : [];
    if (rawItems.length > MAX_CART_PREVIEW_ITEMS) {
      return NextResponse.json({ error: "Too many items" }, { status: 400 });
    }
    const items: PreviewItem[] = rawItems
      .map((row: Record<string, unknown>) => previewItemFromBody(row))
      .filter((row): row is PreviewItem => row != null);

    if (items.length === 0) {
      return NextResponse.json({ deliveryCharge: 0, lines: [] });
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await prisma.products.findMany({
      where: { id: { in: productIds }, is_active: true },
      select: {
        id: true,
        base_price: true,
        discounted_price: true,
        shipping_per_unit: true,
        brand_id: true,
        category_id: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const flashMap = await flashSalePriceMap(productIds);

    const lines = items.map((item) => {
      const p = productMap.get(item.productId);
      const catalogUnit =
        p?.discounted_price != null
          ? Number(p.discounted_price)
          : p?.base_price != null
            ? Number(p.base_price)
            : Math.max(0, Number(item.price ?? 0));
      const unitPrice =
        p != null
          ? unitPriceWithFlashSale(catalogUnit, p.id, flashMap)
          : catalogUnit;
      return {
        productId: item.productId,
        quantity: item.quantity,
        shippingPerUnit: Math.max(0, Number(p?.shipping_per_unit ?? 0)),
        lineSubtotal: unitPrice * item.quantity,
        brandId: p?.brand_id ?? null,
      };
    });

    const [freeShippingThresholdInr, freeShippingExcludedBrandIds, cod] = await Promise.all([
      getFreeShippingThresholdInr(),
      getFreeShippingExcludedBrandIds(),
      getCodEligibilityForProducts(
        productIds.map((productId) => {
          const p = productMap.get(productId);
          return {
            id: productId,
            brand_id: p?.brand_id ?? null,
            category_id: p?.category_id ?? null,
          };
        })
      ),
    ]);

    const breakdown = orderShippingBreakdownFromLines({
      subtotalBeforeDiscount: lines.reduce((sum, line) => sum + line.lineSubtotal, 0),
      lines,
      freeShippingThresholdInr,
      freeShippingExcludedBrandIds,
    });

    return NextResponse.json({
      deliveryCharge: breakdown.totalInr,
      chargeableUnits: breakdown.chargeableUnits,
      freeShippingThresholdInr,
      freeShippingExcludedBrandIds,
      codAvailable: cod.available,
      codReason: cod.reason,
      lines: lines.map(({ productId, brandId, shippingPerUnit }) => ({
        productId,
        brandId,
        shippingPerUnit,
      })),
    });
  });
}
