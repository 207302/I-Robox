import type { CartItem } from "@/redux/features/cart-slice";
import {
  FLASH_SALE_ONE_ITEM_MESSAGE,
  FLASH_SALE_QTY_ONE_MESSAGE,
} from "@/lib/flashSale/messages";

export { FLASH_SALE_ONE_ITEM_MESSAGE, FLASH_SALE_QTY_ONE_MESSAGE };

export function cartFlashSaleError(
  items: CartItem[],
  incoming: Pick<CartItem, "id" | "flashSaleTag" | "quantity">,
  opts?: { replacingQty?: number }
): string | null {
  const tag = incoming.flashSaleTag?.trim() || null;
  if (!tag) return null;

  const otherFlash = items.find(
    (i) => i.flashSaleTag && String(i.id) !== String(incoming.id)
  );
  if (otherFlash) return FLASH_SALE_ONE_ITEM_MESSAGE;

  const existing = items.find((i) => String(i.id) === String(incoming.id));
  const nextQty =
    opts?.replacingQty ??
    (existing ? existing.quantity + (incoming.quantity || 1) : incoming.quantity || 1);
  if (nextQty > 1) return FLASH_SALE_QTY_ONE_MESSAGE;

  return null;
}
