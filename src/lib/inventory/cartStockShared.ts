/** Client-safe stock helpers (no Prisma). Server routes use cartStock.ts. */

export type CartStockLine = {
  productId: string;
  quantity: number;
  productVariantId?: string | null;
};

export type ProductStockStatus = {
  availableQuantity: number;
  inStock: boolean;
};

export type StockShortfall = {
  productId: string;
  productName: string;
  availableQuantity: number;
  requestedQuantity: number;
};

export class StockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockValidationError";
  }
}

export function stockLookupKey(productId: string, productVariantId?: string | null): string {
  const variant = productVariantId?.trim();
  return variant ? `${productId}:${variant}` : productId;
}

export function stockShortfallMessage(shortfall: StockShortfall): string {
  if (shortfall.availableQuantity <= 0) {
    return `${shortfall.productName} is out of stock`;
  }
  return `${shortfall.productName} only has ${shortfall.availableQuantity} available (your cart has ${shortfall.requestedQuantity})`;
}

export function formatStockShortfallsMessage(shortfalls: StockShortfall[]): string {
  if (shortfalls.length === 0) return "One or more items are out of stock";
  if (shortfalls.length === 1) return stockShortfallMessage(shortfalls[0]!);
  const names = shortfalls.map((s) => s.productName);
  return `The following items are out of stock: ${names.join(", ")}`;
}

export function findStockShortfalls(
  items: CartStockLine[],
  stockMap: Map<string, ProductStockStatus>,
  productNames: Map<string, string>
): StockShortfall[] {
  const qtyByKey = new Map<string, { productId: string; quantity: number }>();
  for (const item of items) {
    const key = stockLookupKey(item.productId, item.productVariantId);
    const prev = qtyByKey.get(key);
    qtyByKey.set(key, {
      productId: item.productId,
      quantity: (prev?.quantity ?? 0) + item.quantity,
    });
  }

  const shortfalls: StockShortfall[] = [];
  for (const [key, { productId, quantity: requestedQuantity }] of qtyByKey) {
    const availableQuantity = stockMap.get(key)?.availableQuantity ?? 0;
    if (availableQuantity < requestedQuantity) {
      shortfalls.push({
        productId,
        productName: productNames.get(productId) ?? "An item in your cart",
        availableQuantity,
        requestedQuantity,
      });
    }
  }

  return shortfalls;
}
