import type { CartItem } from "@/redux/features/cart-slice";
import {
  FLASH_SALE_ONE_ITEM_MESSAGE,
  FLASH_SALE_QTY_ONE_MESSAGE,
  flashSaleQtyLimitMessage,
} from "@/lib/flashSale/messages";

export { FLASH_SALE_ONE_ITEM_MESSAGE, FLASH_SALE_QTY_ONE_MESSAGE };

export function flashSaleEffectiveMaxQty(opts: {
  purchaseLimit?: number | null;
  used: number;
  catalogMax: number;
  sameTagOtherCartQty?: number;
}): number {
  const catalog = Math.max(0, opts.catalogMax);
  const limit = opts.purchaseLimit ?? 0;
  if (limit <= 0) return catalog;
  const remaining = limit - opts.used - (opts.sameTagOtherCartQty ?? 0);
  return Math.max(0, Math.min(catalog, remaining));
}

function sameTagCartQty(
  items: CartItem[],
  tag: string,
  exceptLineId?: string | number
): number {
  return items.reduce((sum, item) => {
    if (!item.flashSaleTag || item.flashSaleTag !== tag) return sum;
    if (exceptLineId != null && String(item.id) === String(exceptLineId)) return sum;
    return sum + item.quantity;
  }, 0);
}

export function cartFlashSaleError(
  items: CartItem[],
  incoming: Pick<CartItem, "id" | "flashSaleTag" | "quantity" | "flashSalePurchaseLimit">,
  opts?: { replacingQty?: number }
): string | null {
  const tag = incoming.flashSaleTag?.trim() || null;
  if (!tag) return null;

  const otherDifferentTag = items.find(
    (i) =>
      Boolean(i.flashSaleTag) &&
      i.flashSaleTag !== tag &&
      String(i.id) !== String(incoming.id)
  );
  if (otherDifferentTag) return FLASH_SALE_ONE_ITEM_MESSAGE;

  const existing = items.find((i) => String(i.id) === String(incoming.id));
  const nextQty =
    opts?.replacingQty ??
    (existing ? existing.quantity + (incoming.quantity || 1) : incoming.quantity || 1);

  // Total units across every cart line in this flash sale (not per product).
  const total = sameTagCartQty(items, tag, incoming.id) + Math.max(0, nextQty);
  const limits = [
    incoming.flashSalePurchaseLimit,
    existing?.flashSalePurchaseLimit,
    ...items.filter((i) => i.flashSaleTag === tag).map((i) => i.flashSalePurchaseLimit),
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  const limit = limits.length ? Math.min(...limits) : 1;
  if (total > limit) {
    return flashSaleQtyLimitMessage(limit);
  }

  return null;
}
