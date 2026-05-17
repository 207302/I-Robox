/** @deprecated Import from `@/lib/cache/tags` or `@/lib/cache/revalidate`. */
export {
  PRODUCT_CATALOG_TAG,
  SHOP_LISTING_TAG,
  CATEGORIES_TAG,
  BRANDS_TAG,
  HEADER_NAV_TAG,
  productSlugTag,
  productReviewsTag,
} from "@/lib/cache/tags";

export { PRODUCT_PAGE_REVALIDATE_SECONDS } from "@/lib/cache/constants";

export {
  revalidateProductCatalog,
  revalidateProductById,
  revalidateProductReviews,
  revalidateProductReviewsByReviewId,
  revalidateCategoryCatalog,
  type RevalidateProductCatalogOptions,
} from "@/lib/cache/revalidate";
