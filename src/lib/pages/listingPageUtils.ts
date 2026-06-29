import type { ShopListingItem } from "@/lib/shop/shopListing";
import type { Product } from "@/types/product";

export function shopListingItemToProduct(item: ShopListingItem): Product {
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    discountedPrice: item.discountedPrice,
    slug: item.slug,
    quantity: item.quantity,
    updatedAt: item.updatedAt,
    reviews: item.reviews,
    shortDescription: item.shortDescription,
    ageGroup: item.ageGroup,
    diecastScale: item.diecastScale,
    shippingPerUnit: item.shippingPerUnit,
    brandId: item.brandId ?? null,
    productVariants: item.productVariants,
    product_images: item.product_images,
    image: item.image,
  };
}

export function buildBrandListingQuery(
  brandSlug: string,
  opts: {
    page?: number;
    sort?: string;
    categorySlug?: string;
    minPrice?: string;
    maxPrice?: string;
  } = {}
): string {
  const params = new URLSearchParams();
  params.append("brand", brandSlug);
  if (opts.categorySlug) params.append("category", opts.categorySlug);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.minPrice) params.set("minPrice", opts.minPrice);
  if (opts.maxPrice) params.set("maxPrice", opts.maxPrice);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  return params.toString();
}

export function buildCategoryListingQuery(
  categorySlug: string,
  opts: {
    page?: number;
    sort?: string;
    brandSlug?: string;
    minPrice?: string;
    maxPrice?: string;
    subtypeSlug?: string;
  } = {}
): string {
  const params = new URLSearchParams();
  params.append("category", categorySlug);
  if (opts.brandSlug) params.append("brand", opts.brandSlug);
  if (opts.subtypeSlug) params.append("subtype", opts.subtypeSlug);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.minPrice) params.set("minPrice", opts.minPrice);
  if (opts.maxPrice) params.set("maxPrice", opts.maxPrice);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  return params.toString();
}
