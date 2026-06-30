export const SHOP_MOBILE_GRID_STORAGE_KEY = "irobox-shop-mobile-grid";

export type ShopMobileGridColumns = 1 | 2;

export function readShopMobileGridColumns(): ShopMobileGridColumns {
  if (typeof window === "undefined") return 1;
  try {
    return localStorage.getItem(SHOP_MOBILE_GRID_STORAGE_KEY) === "2" ? 2 : 1;
  } catch {
    return 1;
  }
}

export function shopProductGridClassName(mobileColumns: ShopMobileGridColumns): string {
  const base = "grid px-4 py-6 lg:grid-cols-3 lg:gap-x-7.5 lg:gap-y-9";
  if (mobileColumns === 2) {
    return `${base} shop-product-grid-mobile-2 grid-cols-2 gap-4 max-lg:grid-cols-2`;
  }
  return `${base} grid-cols-1 gap-x-7.5 gap-y-9 max-lg:grid-cols-1`;
}
