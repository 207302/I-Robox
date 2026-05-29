/** Responsive `sizes` for product cards in 1 / 2 / 3 column grids (shop, home sections, etc.). */
export const PRODUCT_CARD_GRID_SIZES =
  "(max-width: 639px) min(calc(100vw - 2rem), 380px), (max-width: 1023px) calc(50vw - 2rem), (max-width: 1279px) calc(33vw - 1.5rem), 280px";

/** Home new-arrivals / best-sellers — 2-col mobile, 4-col desktop carousel/grid. */
export const HOME_PRODUCT_CARD_SIZES =
  "(max-width: 639px) calc(50vw - 1rem), (max-width: 1279px) calc(25vw - 1rem), 320px";

/** Alias for shop page imports. */
export const SHOP_GRID_CARD_SIZES = PRODUCT_CARD_GRID_SIZES;
