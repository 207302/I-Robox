import { normalizeCartItems } from "@/lib/cart/cartLine";
import { CartItem } from "@/redux/features/cart-slice";

const CART_STORAGE_KEY = "irobox-cart";
const STORAGE_SCOPE_KEY = "irobox_storage_scope";

export function getCurrentScope(): string {
    try {
        return localStorage.getItem(STORAGE_SCOPE_KEY) || "guest";
    } catch {
        return "guest";
    }
}

function readScopedCart(scope: string): CartItem[] {
    try {
        const raw = localStorage.getItem(`${CART_STORAGE_KEY}:${scope}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? normalizeCartItems(parsed as CartItem[]) : [];
    } catch {
        return [];
    }
}

function writeScopedCart(scope: string, items: CartItem[]): void {
    try {
        localStorage.setItem(`${CART_STORAGE_KEY}:${scope}`, JSON.stringify(items));
    } catch {
        /* quota / private mode */
    }
}

/** Combine two carts. The same line's quantities are added. Lines on only one side are kept. */
export function mergeCartItems(primary: CartItem[], incoming: CartItem[]): CartItem[] {
    const merged = new Map<string, CartItem>();
    for (const item of normalizeCartItems(primary)) {
        merged.set(String(item.id), { ...item });
    }
    for (const item of normalizeCartItems(incoming)) {
        const key = String(item.id);
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, { ...item });
            continue;
        }
        merged.set(key, {
            ...existing,
            quantity: existing.quantity + item.quantity,
        });
    }
    return [...merged.values()];
}

/**
 * Load the cart for the current session.
 * Guest → account: merge the guest cart into the account cart, then clear the guest copy.
 * Account → guest (expired session or sign-out): keep those items visible under the guest
 * key and drop the account copy so the next sign-in does not add them twice.
 */
export function loadCartForSessionScope(nextScope: string): CartItem[] {
    const scope = nextScope.trim() || "guest";
    const previous = getCurrentScope();

    if (previous === "guest" && scope !== "guest") {
        const merged = mergeCartItems(readScopedCart(scope), readScopedCart("guest"));
        setStorageScope(scope);
        writeScopedCart(scope, merged);
        try {
            localStorage.removeItem(`${CART_STORAGE_KEY}:guest`);
        } catch {
            /* ignore */
        }
        return merged;
    }

    if (previous !== "guest" && scope === "guest") {
        const preserved = mergeCartItems(readScopedCart("guest"), readScopedCart(previous));
        setStorageScope("guest");
        writeScopedCart("guest", preserved);
        try {
            localStorage.removeItem(`${CART_STORAGE_KEY}:${previous}`);
        } catch {
            /* ignore */
        }
        return preserved;
    }

    setStorageScope(scope);
    return loadCartFromStorage();
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
