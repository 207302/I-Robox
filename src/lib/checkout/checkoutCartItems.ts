import { normalizeCartItem } from "@/lib/cart/cartLine";
import type { CartItem } from "@/redux/features/cart-slice";
import { isUuid } from "@/lib/validation/input";

export type CheckoutQuantityItem = {
  productId: string;
  quantity: number;
  price?: number;
};

/** Resolve product UUID + quantity from a cart row (handles variant line ids). */
export function checkoutItemFromCart(raw: CartItem): CheckoutQuantityItem | null {
  const item = normalizeCartItem(raw);
  const productId = String(item.productId ?? "").trim();
  if (!isUuid(productId)) return null;
  const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
  const price = Number(item.price ?? 0);
  return { productId, quantity, price: Number.isFinite(price) ? price : 0 };
}

export function checkoutItemsFromCart(cartItems: CartItem[]): CheckoutQuantityItem[] {
  return cartItems
    .map((raw) => checkoutItemFromCart(raw))
    .filter((row): row is CheckoutQuantityItem => row != null);
}
