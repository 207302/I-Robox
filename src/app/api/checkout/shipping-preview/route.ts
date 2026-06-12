import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { orderShippingBreakdownFromLines } from "@/lib/checkout/orderShipping";
import {
  getFreeShippingExcludedBrandIds,
  getFreeShippingThresholdInr,
} from "@/lib/marketing/freeShipping";
import { isUuid, readJsonBody } from "@/lib/validation/input";
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
    const body = await readJsonBody(req);
    const rawItems = Array.isArray(body.items) ? body.items : [];
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
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines = items.map((item) => {
      const p = productMap.get(item.productId);
      const unitPrice =
        p?.discounted_price != null
          ? Number(p.discounted_price)
          : p?.base_price != null
            ? Number(p.base_price)
            : Math.max(0, Number(item.price ?? 0));
      return {
        productId: item.productId,
        quantity: item.quantity,
        shippingPerUnit: Math.max(0, Number(p?.shipping_per_unit ?? 0)),
        lineSubtotal: unitPrice * item.quantity,
        brandId: p?.brand_id ?? null,
      };
    });

    const [freeShippingThresholdInr, freeShippingExcludedBrandIds] = await Promise.all([
      getFreeShippingThresholdInr(),
      getFreeShippingExcludedBrandIds(),
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
      lines: lines.map(({ productId, brandId, shippingPerUnit }) => ({
        productId,
        brandId,
        shippingPerUnit,
      })),
    });
  });
}
