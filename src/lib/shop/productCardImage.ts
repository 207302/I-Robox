/** Card/thumbnail URL — same rules as `ProductItem` (default variant, then any variant image, then gallery). */
export function getProductCardImageUrl(item: {
  image?: string;
  product_images?: { url: string }[];
  productVariants: { image?: string; isDefault?: boolean; color?: string; name?: string }[];
}): string {
  const defaultVariant = item.productVariants?.find((v) => v.isDefault);
  const firstVariantWithImage = item.productVariants?.find((v) => Boolean(v.image));
  return (
    item.image ||
    defaultVariant?.image ||
    firstVariantWithImage?.image ||
    item.product_images?.[0]?.url ||
    ""
  );
}
