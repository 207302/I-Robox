import "server-only";

import { prisma } from "@/lib/prisma";
import {
  formatStockShortfallsMessage,
  findStockShortfalls,
  stockLookupKey,
  StockValidationError,
  type CartStockLine,
  type ProductStockStatus,
  type StockShortfall,
} from "@/lib/inventory/cartStockShared";

export {
  formatStockShortfallsMessage,
  findStockShortfalls,
  stockLookupKey,
  StockValidationError,
  stockShortfallMessage,
} from "@/lib/inventory/cartStockShared";
export type { CartStockLine, ProductStockStatus, StockShortfall };

export async function getProductStockStatusMap(
  lines: CartStockLine[]
): Promise<Map<string, ProductStockStatus>> {
  const unique = new Map<string, CartStockLine>();
  for (const line of lines) {
    if (!line.productId) continue;
    const key = stockLookupKey(line.productId, line.productVariantId);
    if (!unique.has(key)) unique.set(key, line);
  }

  const map = new Map<string, ProductStockStatus>();
  if (unique.size === 0) return map;

  const orConditions = [...unique.values()].map((line) => ({
    product_id: line.productId,
    product_variant_id: line.productVariantId?.trim() || null,
  }));

  const rows = await prisma.inventory.findMany({
    where: { OR: orConditions },
    select: {
      product_id: true,
      product_variant_id: true,
      available_quantity: true,
    },
  });

  const byKey = new Map(
    rows.map((r) => [
      stockLookupKey(r.product_id, r.product_variant_id),
      r.available_quantity,
    ])
  );

  for (const [key] of unique) {
    const raw = byKey.get(key);
    const availableQuantity =
      raw != null && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    map.set(key, {
      availableQuantity,
      inStock: availableQuantity > 0,
    });
  }

  return map;
}

export async function assertCartItemsInStock(
  items: CartStockLine[],
  productNames: Map<string, string>
): Promise<void> {
  const stockMap = await getProductStockStatusMap(items);
  const shortfalls = findStockShortfalls(items, stockMap, productNames);
  if (shortfalls.length > 0) {
    throw new StockValidationError(formatStockShortfallsMessage(shortfalls));
  }
}

/** Best-effort: mark server-persisted active carts when stock changes (checkout re-fetch handles client carts). */
export async function touchActiveCartsContainingProduct(productId: string) {
  await prisma.carts.updateMany({
    where: {
      status: "ACTIVE",
      cart_items: { some: { product_id: productId } },
    },
    data: { updated_at: new Date() },
  });
}
