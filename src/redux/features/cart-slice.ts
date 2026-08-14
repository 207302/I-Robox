import { normalizeCartItem } from "@/lib/cart/cartLine";
import {
  clampAddToCartQuantity,
  resolveMaxOrderQuantity,
  totalCartQuantityForProduct,
} from "@/lib/cart/maxOrderQuantity";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

type InitialState = {
  items: CartItem[];
  shouldDisplayCart: boolean;
};

export type CartItem = {
  /** Unique line id (product id, or `productId::variantId` when variants exist). */
  id: string | number;
  /** Parent product id — used at checkout. */
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
  name: string;
  price: number;
  quantity: number;
  shippingPerUnit?: number;
  brandId?: string | null;
  currency?: string;
  image?: string;
  slug?: string;
  availableQuantity?: number;
  maxOrderQuantity?: number;
  /** Claim key when line is priced via an active flash sale. */
  flashSaleTag?: string | null;
  /** Remaining per-customer units allowed for this sale tag (at add time). */
  flashSalePurchaseLimit?: number | null;
  color?: string;
  size?: string;
  attribute?: any;
  // Legacy support
  title?: string;
  imgs?: {
    thumbnails: string[];
    previews: string[];
  };
};

const initialState: InitialState = {
  items: [],
  shouldDisplayCart: false,
};

export const cart = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItemToCart: (state, action: PayloadAction<CartItem>) => {
      const item = normalizeCartItem(action.payload);
      const existingItem = state.items.find((i) => i.id === item.id);
      const requestedQty = item.quantity || 1;
      const cappedQty = clampAddToCartQuantity({
        items: state.items,
        productId: item.productId,
        lineId: item.id,
        requestedQty: existingItem ? existingItem.quantity + requestedQty : requestedQty,
        maxOrderQuantity: item.maxOrderQuantity,
        availableQuantity: item.availableQuantity,
      });

      if (cappedQty <= 0) return;

      if (existingItem) {
        existingItem.quantity = cappedQty;
        if (item.maxOrderQuantity != null) {
          existingItem.maxOrderQuantity = resolveMaxOrderQuantity(item.maxOrderQuantity);
        }
        if (item.shippingPerUnit != null) {
          existingItem.shippingPerUnit = Math.max(0, Number(item.shippingPerUnit));
        }
        if (item.brandId !== undefined) {
          existingItem.brandId = item.brandId ?? null;
        }
        if (item.flashSaleTag !== undefined) {
          existingItem.flashSaleTag = item.flashSaleTag ?? null;
        }
        if (item.flashSalePurchaseLimit !== undefined) {
          existingItem.flashSalePurchaseLimit = item.flashSalePurchaseLimit ?? null;
        }
      } else {
        state.items.push({
          ...item,
          quantity: cappedQty,
          maxOrderQuantity:
            item.maxOrderQuantity != null
              ? resolveMaxOrderQuantity(item.maxOrderQuantity)
              : undefined,
        });
      }
    },
    removeItemFromCart: (state, action: PayloadAction<string | number>) => {
      const itemId = action.payload;
      state.items = state.items.filter((item) => item.id !== itemId);
    },
    incrementItem: (state, action: PayloadAction<string | number>) => {
      const itemId = action.payload;
      const existingItem = state.items.find((item) => item.id === itemId);

      if (!existingItem) return;

      if (existingItem.maxOrderQuantity != null) {
        const maxOrderQty = resolveMaxOrderQuantity(existingItem.maxOrderQuantity);
        const totalForProduct = totalCartQuantityForProduct(state.items, existingItem.productId);
        if (totalForProduct >= maxOrderQty) return;
      }

      const stock = existingItem.availableQuantity;
      if (stock != null && Number.isFinite(stock) && existingItem.quantity >= stock) return;

      existingItem.quantity += 1;
    },
    decrementItem: (state, action: PayloadAction<string | number>) => {
      const itemId = action.payload;
      const existingItem = state.items.find((item) => item.id === itemId);
      if (!existingItem) return;

      if (existingItem.quantity <= 1) {
        state.items = state.items.filter((item) => item.id !== itemId);
      } else {
        existingItem.quantity -= 1;
      }
    },
    updateCartItemQuantity: (
      state,
      action: PayloadAction<{ id: string | number; quantity: number }>
    ) => {
      const { id, quantity } = action.payload;
      const existingItem = state.items.find((item) => item.id === id);

      if (!existingItem) return;

      const cappedQty = clampAddToCartQuantity({
        items: state.items,
        productId: existingItem.productId,
        lineId: id,
        requestedQty: quantity,
        maxOrderQuantity: existingItem.maxOrderQuantity,
        availableQuantity: existingItem.availableQuantity,
      });

      if (cappedQty <= 0) {
        state.items = state.items.filter((item) => item.id !== id);
        return;
      }

      existingItem.quantity = cappedQty;
    },
    clearCart: (state) => {
      state.items = [];
    },
    removeAllItemsFromCart: (state) => {
      state.items = [];
    },
    loadCartFromStorage: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload.map(normalizeCartItem);
    },
    hydrateCartProductMeta: (
      state,
      action: PayloadAction<
        Record<
          string,
          {
            maxOrderQuantity: number;
            shippingPerUnit: number;
            brandId: string | null;
            availableQuantity: number;
          }
        >
      >
    ) => {
      const metaByProductId = action.payload;
      state.items = state.items.flatMap((item) => {
        const meta = metaByProductId[String(item.productId)];
        if (!meta) return [item];

        const cappedQty = clampAddToCartQuantity({
          items: state.items,
          productId: item.productId,
          lineId: item.id,
          requestedQty: item.quantity,
          maxOrderQuantity: meta.maxOrderQuantity,
          availableQuantity: meta.availableQuantity,
        });
        if (cappedQty <= 0) return [];

        return [
          {
            ...item,
            quantity: cappedQty,
            maxOrderQuantity: meta.maxOrderQuantity,
            shippingPerUnit: meta.shippingPerUnit,
            brandId: meta.brandId,
            availableQuantity: meta.availableQuantity,
          },
        ];
      });
    },
    toggleCartModal: (state) => {
      state.shouldDisplayCart = !state.shouldDisplayCart;
    },
    setCartModalOpen: (state, action: PayloadAction<boolean>) => {
      state.shouldDisplayCart = action.payload;
    },
  },
});

// Selectors
export const selectCartItems = (state: RootState) => state.cartReducer.items;

export const selectShouldDisplayCart = (state: RootState) =>
  state.cartReducer.shouldDisplayCart;

export const selectCartCount = createSelector([selectCartItems], (items) => {
  return items.reduce((total, item) => total + item.quantity, 0);
});

export const selectCartDetails = createSelector([selectCartItems], (items) => {
  const details: Record<string | number, CartItem> = {};
  items.forEach((item) => {
    details[item.id] = item;
  });
  return details;
});

export const selectTotalPrice = createSelector([selectCartItems], (items) => {
  return items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
});

export const selectFormattedTotalPrice = createSelector(
  [selectTotalPrice],
  (totalPrice) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(totalPrice);
  }
);

export const {
  addItemToCart,
  removeItemFromCart,
  incrementItem,
  decrementItem,
  updateCartItemQuantity,
  clearCart,
  removeAllItemsFromCart,
  loadCartFromStorage,
  hydrateCartProductMeta,
  toggleCartModal,
  setCartModalOpen,
} = cart.actions;
export default cart.reducer;
