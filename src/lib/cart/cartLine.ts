import type { CartItem } from "@/redux/features/cart-slice";

const LINE_SEP = "::";

export type VariantCartInput = {
  id: string;
  name?: string | null;
  color?: string | null;
  size?: string | null;
  image?: string | null;
  isDefault?: boolean;
};

/** Unique cart row id: one line per product variant; plain product id when no variants. */
export function buildCartLineId(
  productId: string,
  variantId?: string | null,
  hasVariants?: boolean
): string {
  if (hasVariants && variantId) return `${productId}${LINE_SEP}${variantId}`;
  return productId;
}

export function formatVariantLabel(variant?: {
  name?: string | null;
  color?: string | null;
  size?: string | null;
}): string {
  if (!variant) return "";
  const color = variant.color?.trim();
  const name = variant.name?.trim();
  const size = variant.size?.trim();
  if (color && name && color !== name) return `${color} · ${name}`;
  if (color) return color;
  if (name) return name;
  if (size) return size;
  return "";
}

export function pickDefaultVariant<T extends { isDefault?: boolean }>(
  variants: T[]
): T | undefined {
  return variants.find((v) => v.isDefault) ?? variants[0];
}

/** Backfill `productId` on items saved before variant-aware cart. */
export function normalizeCartItem(item: CartItem): CartItem {
  const idStr = String(item.id);
  if (item.productId) {
    return {
      ...item,
      productId: String(item.productId),
      variantId: item.variantId ?? null,
    };
  }
  const sep = idStr.indexOf(LINE_SEP);
  if (sep !== -1) {
    return {
      ...item,
      productId: idStr.slice(0, sep),
      variantId: idStr.slice(sep + LINE_SEP.length) || null,
    };
  }
  return {
    ...item,
    productId: idStr,
    variantId: null,
  };
}

export function normalizeCartItems(items: CartItem[]): CartItem[] {
  return items.map(normalizeCartItem);
}
