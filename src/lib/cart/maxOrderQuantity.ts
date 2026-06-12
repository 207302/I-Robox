import type { CartItem } from "@/redux/features/cart-slice";

export const DEFAULT_MAX_ORDER_QUANTITY = 99;

export function resolveMaxOrderQuantity(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_MAX_ORDER_QUANTITY;
  return Math.min(1000, Math.max(1, Math.round(value)));
}

/** Total cart quantity for a product (all lines / variants combined). */
export function totalCartQuantityForProduct(
  items: Pick<CartItem, "productId" | "quantity">[],
  productId: string,
  excludeLineId?: string | number
): number {
  return items.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (excludeLineId != null && String(item.id) === String(excludeLineId)) return sum;
    return sum + item.quantity;
  }, 0);
}

export function maxOrderQuantityError(productName: string, maxOrderQty: number): string {
  return `${productName} allows max ${maxOrderQty} per order`;
}

/** Throws `MAX_ORDER_QTY_EXCEEDED:name:max` when any product exceeds its per-order cap. */
export function assertMaxOrderQuantities(
  items: { productId: string; quantity: number }[],
  productMeta: Map<string, { name: string; max_order_quantity: number | null | undefined }>
): void {
  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  for (const [productId, totalQty] of qtyByProduct.entries()) {
    const meta = productMeta.get(productId);
    if (!meta) continue;
    const maxOrderQty = resolveMaxOrderQuantity(meta.max_order_quantity);
    if (totalQty > maxOrderQty) {
      throw new Error(`MAX_ORDER_QTY_EXCEEDED:${meta.name}:${maxOrderQty}`);
    }
  }
}

export function canIncreaseCartQuantity(input: {
  items: CartItem[];
  lineId: string | number;
  productId: string;
  maxOrderQuantity?: number | null;
  availableQuantity?: number;
  currentLineQuantity: number;
}): { ok: true } | { ok: false; reason: "max_order" | "stock"; maxOrderQty: number } {
  const maxOrderQty = resolveMaxOrderQuantity(input.maxOrderQuantity);
  const totalForProduct = totalCartQuantityForProduct(input.items, input.productId);
  if (totalForProduct >= maxOrderQty) {
    return { ok: false, reason: "max_order", maxOrderQty };
  }
  const stock = input.availableQuantity;
  if (stock != null && Number.isFinite(stock) && input.currentLineQuantity >= stock) {
    return { ok: false, reason: "stock", maxOrderQty };
  }
  return { ok: true };
}

export function clampAddToCartQuantity(input: {
  items: CartItem[];
  productId: string;
  lineId: string | number;
  requestedQty: number;
  maxOrderQuantity?: number | null;
  availableQuantity?: number;
}): number {
  const requested = Math.max(1, Math.floor(input.requestedQty));
  const maxOrderQty = resolveMaxOrderQuantity(input.maxOrderQuantity);
  const otherLinesQty = totalCartQuantityForProduct(input.items, input.productId, input.lineId);
  const roomByMax = Math.max(0, maxOrderQty - otherLinesQty);
  let qty = Math.min(requested, roomByMax);
  const stock = input.availableQuantity;
  if (stock != null && Number.isFinite(stock)) {
    qty = Math.min(qty, Math.max(0, stock));
  }
  return qty;
}
