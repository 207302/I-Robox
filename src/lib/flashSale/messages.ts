export const FLASH_SALE_ALREADY_CLAIMED_MESSAGE =
  "You have already used this flash sale offer.";
export const FLASH_SALE_ONE_ITEM_MESSAGE =
  "Items from different flash sales can't be in the cart together.";

export function flashSaleQtyLimitMessage(limit: number): string {
  if (limit <= 1) return "Flash sale items are limited to quantity 1.";
  return `You can buy at most ${limit} items from this flash sale.`;
}

export function flashSaleLimitReachedMessage(limit: number): string {
  if (limit <= 1) return FLASH_SALE_ALREADY_CLAIMED_MESSAGE;
  return `You have reached the limit of ${limit} items for this flash sale.`;
}

/** @deprecated Use flashSaleQtyLimitMessage */
export const FLASH_SALE_QTY_ONE_MESSAGE = flashSaleQtyLimitMessage(1);
