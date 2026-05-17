/**
 * Central cache tag registry for `unstable_cache` + `revalidateTag`.
 * @see src/lib/cache/CACHE_TAGS.md
 */

/** Product rails, PDP, shop facets, diecast scales. */
export const PRODUCT_CATALOG_TAG = "products";

/** `getShopListing`, listing facet bundles, category tree. */
export const SHOP_LISTING_TAG = "shop-listing";

/** Category tree, header nav categories, home category fallback. */
export const CATEGORIES_TAG = "categories";

/** Header nav brand dropdown. */
export const BRANDS_TAG = "brands";

/** `getHeaderNavData` bundle (categories + brands). */
export const HEADER_NAV_TAG = "header-nav";

/** `getHomePageData` ISR bundle. */
export const HOME_PAGE_TAG = "home-page";

/** Site settings, chrome colors, hero overlay copy. */
export const MARKETING_TAG = "marketing";

/** Utility + marquee bars (`getSiteLayoutShell`). */
export const ANNOUNCEMENTS_TAG = "announcements";

/** `getMarketingPopups` (admin). */
export const POPUPS_TAG = "marketing-popups";

/** `getFlashSaleProducts` + PDP flash pricing. */
export const FLASH_SALES_TAG = "flash-sales";

/** Best-seller aggregation (`getBestSellingProducts`). */
export const ORDERS_TAG = "orders";

/** `getSeoSettings` (if used on storefront). */
export const SEO_TAG = "seo-setting";

export function productSlugTag(slug: string): string {
  return `product:slug:${slug.trim()}`;
}

export function productReviewsTag(productId: string): string {
  return `product:reviews:${productId.trim()}`;
}
