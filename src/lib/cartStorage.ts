import { normalizeCartItems } from "@/lib/cart/cartLine";
import { CartItem } from "@/redux/features/cart-slice";

const CART_STORAGE_KEY = "irobox-cart";
const STORAGE_SCOPE_KEY = "irobox_storage_scope";

function getCurrentScope(): string {
    try {
        return localStorage.getItem(STORAGE_SCOPE_KEY) || "guest";
    } catch {
        return "guest";
    }
}

function getScopedCartStorageKey() {
    return `${CART_STORAGE_KEY}:${getCurrentScope()}`;
}

export const setStorageScope = (scope: string): void => {
    try {
        localStorage.setItem(STORAGE_SCOPE_KEY, scope || "guest");
    } catch {
        // ignore storage write failures
    }
};

/**
 * Save cart items to localStorage
 */
export const saveCartToStorage = (items: CartItem[]): void => {
    try {
        const serializedCart = JSON.stringify(items);
        localStorage.setItem(getScopedCartStorageKey(), serializedCart);
    } catch (error) {
        // Handle quota exceeded or other localStorage errors
        if (error instanceof Error) {
            if (error.name === "QuotaExceededError") {
                console.error("LocalStorage quota exceeded. Unable to save cart.");
            } else if (error.name === "SecurityError") {
                console.error("LocalStorage access denied (private browsing mode?).");
            } else {
                console.error("Failed to save cart to localStorage:", error.message);
            }
        }
    }
};

/**
 * Load cart items from localStorage
 */
export const loadCartFromStorage = (): CartItem[] => {
    try {
        const serializedCart = localStorage.getItem(getScopedCartStorageKey());
        if (serializedCart === null) {
            return [];
        }
        return normalizeCartItems(JSON.parse(serializedCart) as CartItem[]);
    } catch (error) {
        // Handle JSON parse errors or localStorage access errors
        if (error instanceof Error) {
            console.error("Failed to load cart from localStorage:", error.message);
        }
        return [];
    }
};

/**
 * Clear cart data from localStorage
 */
export const clearCartStorage = (): void => {
    try {
        localStorage.removeItem(getScopedCartStorageKey());
    } catch (error) {
        if (error instanceof Error) {
            console.error("Failed to clear cart from localStorage:", error.message);
        }
    }
};
