export function firstProductImageUrl(product: {
  product_images?: { url: string }[];
}): string | null {
  return product.product_images?.[0]?.url ?? null;
}

export const adminProductImageSelect = {
  orderBy: { sort_order: "asc" as const },
  take: 1,
  select: { url: true },
};
