import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMaxOrderQuantity } from "@/lib/cart/maxOrderQuantity";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { isUuid, readJsonBody } from "@/lib/validation/input";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawIds = Array.isArray(parsed.body.productIds) ? parsed.body.productIds : [];
    const productIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && isUuid(id)))];

    if (productIds.length === 0) {
      return NextResponse.json({ products: {} });
    }

    const rows = await prisma.products.findMany({
      where: { id: { in: productIds }, is_active: true },
      select: {
        id: true,
        max_order_quantity: true,
        shipping_per_unit: true,
        brand_id: true,
        inventory: {
          select: { available_quantity: true },
          take: 1,
        },
      },
    });

    const products: Record<
      string,
      {
        maxOrderQuantity: number;
        shippingPerUnit: number;
        brandId: string | null;
        availableQuantity: number;
      }
    > = {};

    for (const row of rows) {
      const stock = row.inventory[0]?.available_quantity;
      products[row.id] = {
        maxOrderQuantity: resolveMaxOrderQuantity(row.max_order_quantity),
        shippingPerUnit: Math.max(0, Number(row.shipping_per_unit ?? 0)),
        brandId: row.brand_id ?? null,
        availableQuantity:
          stock != null && Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
      };
    }

    return NextResponse.json({ products });
  });
}
