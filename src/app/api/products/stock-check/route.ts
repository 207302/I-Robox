import { NextRequest, NextResponse } from "next/server";
import {
  getProductStockStatusMap,
  stockLookupKey,
  type CartStockLine,
} from "@/lib/inventory/cartStock";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { isUuid } from "@/lib/validation/input";

function parseStockCheckLines(req: NextRequest): CartStockLine[] | null {
  const linesParam = req.nextUrl.searchParams.get("lines");
  if (linesParam) {
    try {
      const parsed = JSON.parse(linesParam) as unknown;
      if (!Array.isArray(parsed)) return null;
      const lines: CartStockLine[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const productId = String((entry as { productId?: unknown }).productId ?? "").trim();
        if (!isUuid(productId)) continue;
        const rawVariant = (entry as { productVariantId?: unknown }).productVariantId;
        const productVariantId =
          rawVariant == null || rawVariant === ""
            ? null
            : String(rawVariant).trim();
        if (productVariantId && !isUuid(productVariantId)) continue;
        lines.push({ productId, quantity: 1, productVariantId });
      }
      return lines.length > 0 ? lines : null;
    } catch {
      return null;
    }
  }

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const productIds = [
    ...new Set(
      idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => isUuid(id))
    ),
  ];
  if (productIds.length === 0) return null;
  return productIds.map((productId) => ({ productId, quantity: 1 }));
}

export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const lines = parseStockCheckLines(req);
    if (!lines) {
      return NextResponse.json(
        { error: "ids parameter is required and must contain valid product UUIDs" },
        { status: 400 }
      );
    }

    const stockMap = await getProductStockStatusMap(lines);
    const products: Record<string, { availableQuantity: number; inStock: boolean }> = {};
    for (const line of lines) {
      const key = stockLookupKey(line.productId, line.productVariantId);
      const status = stockMap.get(key) ?? { availableQuantity: 0, inStock: false };
      products[key] = status;
    }

    return NextResponse.json({ products });
  });
}
