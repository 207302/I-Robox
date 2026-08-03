import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
    addItemToCart,
    removeItemFromCart,
    incrementItem,
    decrementItem,
    clearCart,
    toggleCartModal,
    selectCartCount,
    selectCartDetails,
    selectTotalPrice,
    selectFormattedTotalPrice,
    selectShouldDisplayCart,
    CartItem,
} from "@/redux/features/cart-slice";
import { clearCartStorage } from "@/lib/cartStorage";
import {
    canIncreaseCartQuantity,
    clampAddToCartQuantity,
    maxOrderQuantityError,
    resolveMaxOrderQuantity,
} from "@/lib/cart/maxOrderQuantity";
import { cartFlashSaleError } from "@/lib/cart/flashSaleCart";
import toast from "react-hot-toast";

export const useCart = () => {
    const dispatch = useDispatch<AppDispatch>();
    const cartItems = useSelector((state: RootState) => state.cartReducer.items);

    // Selectors
    const cartCount = useSelector(selectCartCount);
    const cartDetails = useSelector(selectCartDetails);
    const totalPrice = useSelector(selectTotalPrice);
    const formattedTotalPrice = useSelector(selectFormattedTotalPrice);
    const shouldDisplayCart = useSelector(selectShouldDisplayCart);

    const addItem = (item: CartItem): boolean => {
        const addQty = item.quantity || 1;
        const existingItem = cartItems.find((i) => i.id === item.id);
        const flashSaleTag = item.flashSaleTag ?? existingItem?.flashSaleTag ?? null;
        const flashErr = cartFlashSaleError(cartItems, {
            id: item.id,
            flashSaleTag,
            quantity: addQty,
        });
        if (flashErr) {
            toast.error(flashErr);
            return false;
        }

        const targetQty = existingItem ? existingItem.quantity + addQty : addQty;
        const maxOrderQty = resolveMaxOrderQuantity(
            item.maxOrderQuantity ?? existingItem?.maxOrderQuantity
        );
        const stock = item.availableQuantity ?? existingItem?.availableQuantity;

        const cappedQty = clampAddToCartQuantity({
            items: cartItems,
            productId: item.productId,
            lineId: item.id,
            requestedQty: targetQty,
            maxOrderQuantity: item.maxOrderQuantity ?? existingItem?.maxOrderQuantity,
            availableQuantity: stock,
        });

        if (cappedQty <= 0) {
            if (item.maxOrderQuantity != null || existingItem?.maxOrderQuantity != null) {
                toast.error(maxOrderQuantityError(item.name, maxOrderQty));
            } else {
                toast.error("Not enough stock available!");
            }
            return false;
        }

        const cappedByLimit = cappedQty < targetQty;
        if (cappedByLimit) {
            if (stock != null && Number.isFinite(stock) && targetQty > stock) {
                toast.error("Not enough stock available!");
            } else {
                toast.error(maxOrderQuantityError(item.name, maxOrderQty));
            }
        }

        dispatch(addItemToCart({
            ...item,
            flashSaleTag,
            maxOrderQuantity: item.maxOrderQuantity ?? existingItem?.maxOrderQuantity,
            quantity: addQty,
        }));
        return !cappedByLimit;
    };

    const removeItem = (id: string | number) => {
        dispatch(removeItemFromCart(id));
    };

    const incrementItemQuantity = (id: string | number) => {
        const existingItem = cartItems.find((item) => item.id === id);
        if (!existingItem) return;

        if (existingItem.flashSaleTag) {
            toast.error(cartFlashSaleError(cartItems, {
                id: existingItem.id,
                flashSaleTag: existingItem.flashSaleTag,
                quantity: 1,
            }, { replacingQty: existingItem.quantity + 1 }) || "Flash sale items are limited to quantity 1.");
            return;
        }

        const check = canIncreaseCartQuantity({
            items: cartItems,
            lineId: id,
            productId: existingItem.productId,
            maxOrderQuantity: existingItem.maxOrderQuantity,
            availableQuantity: existingItem.availableQuantity,
            currentLineQuantity: existingItem.quantity,
        });

        if (!check.ok) {
            if (check.reason === "max_order") {
                toast.error(maxOrderQuantityError(existingItem.name, check.maxOrderQty));
            } else {
                toast.error("Not enough stock available!");
            }
            return;
        }

        dispatch(incrementItem(id));
    };

    const decrementItemQuantity = (id: string | number) => {
        dispatch(decrementItem(id));
    };

    const clearAllItems = () => {
        dispatch(clearCart());
        clearCartStorage();
    };

    const handleCartClick = () => {
        dispatch(toggleCartModal());
    };

    return {
        // State
        cartCount,
        cartDetails,
        totalPrice,
        formattedTotalPrice,
        shouldDisplayCart,

        // Actions
        addItem,
        removeItem,
        incrementItem: incrementItemQuantity,
        decrementItem: decrementItemQuantity,
        clearCart: clearAllItems,
        handleCartClick,
    };
};
