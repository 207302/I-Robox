export const FLASH_SALE_ALREADY_CLAIMED_MESSAGE =
  "You have already used this flash sale offer.";
export const FLASH_SALE_ONE_ITEM_MESSAGE =
  "Items from different flash sales can't be in the cart together.";

function saleLabel(saleName?: string | null): string {
  const name = saleName?.trim();
  return name ? `The "${name}" flash sale` : "This flash sale";
}

export function flashSaleQtyLimitMessage(limit: number, saleName?: string | null): string {
  if (limit <= 1) {
    return `${saleLabel(saleName)} allows only 1 item per customer.`;
  }
  return `${saleLabel(saleName)} allows only ${limit} items per customer.`;
}

export function flashSaleLimitReachedMessage(limit: number, saleName?: string | null): string {
  if (limit <= 1 && !saleName) return FLASH_SALE_ALREADY_CLAIMED_MESSAGE;
  return `You have already bought the maximum (${limit}) from ${saleLabel(saleName).replace(/^The/, "the").replace(/^This/, "this")}.`;
}

export function flashSaleRemainingMessage(
  limit: number,
  remaining: number,
  saleName?: string | null
): string {
  return `${saleLabel(saleName)} allows ${limit} per customer and you can buy only ${remaining} more.`;
}

/** @deprecated Use flashSaleQtyLimitMessage */
export const FLASH_SALE_QTY_ONE_MESSAGE = flashSaleQtyLimitMessage(1);
