import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ANNOUNCEMENTS_TAG,
  BRANDS_TAG,
  CATEGORIES_TAG,
  FLASH_SALES_TAG,
  HEADER_NAV_TAG,
  HOME_PAGE_TAG,
  MARKETING_TAG,
  ORDERS_TAG,
  POPUPS_TAG,
  PRODUCT_CATALOG_TAG,
  SHOP_LISTING_TAG,
  productReviewsTag,
  productSlugTag,
} from "@/lib/cache/tags";

/** Storefront URL paths (route group `(site)` is omitted in paths). */
export const STORE_PATHS = {
  home: "/",
  shop: "/shop",
  product: (slug: string) => `/shop/${encodeURIComponent(slug.trim())}`,
  siteLayout: "/",
} as const;

function revalidateTags(...tags: string[]) {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}

/** Drop cached HTML for key storefront routes (ISR). */
export function revalidateStorePaths(options?: {
  productSlug?: string | null;
  previousProductSlug?: string | null;
  includeLayout?: boolean;
}) {
  revalidatePath(STORE_PATHS.home);
  revalidatePath(STORE_PATHS.shop);

  const slug = options?.productSlug?.trim();
  const previousSlug = options?.previousProductSlug?.trim();
  if (slug) revalidatePath(STORE_PATHS.product(slug));
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(STORE_PATHS.product(previousSlug));
  }
  if (options?.includeLayout) {
    revalidatePath(STORE_PATHS.siteLayout, "layout");
  }
}

export function revalidateHomePage(): void {
  revalidateTags(HOME_PAGE_TAG);
  revalidatePath(STORE_PATHS.home);
}

/** Homepage CMS blocks (hero, highlights, brand rail, category tiles). */
export function revalidateHomePageContent(): void {
  revalidateHomePage();
}

export function revalidateShopListing(): void {
  revalidateTags(SHOP_LISTING_TAG);
  revalidatePath(STORE_PATHS.shop);
}

export type RevalidateProductCatalogOptions = {
  slug?: string | null;
  previousSlug?: string | null;
};

/** Products, shop listing, home rails, optional PDP slug(s). */
export function revalidateProductCatalog(options?: RevalidateProductCatalogOptions): void {
  revalidateTags(PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG, HOME_PAGE_TAG);
  revalidateStorePaths({
    productSlug: options?.slug,
    previousProductSlug: options?.previousSlug,
  });

  const slug = options?.slug?.trim();
  const previousSlug = options?.previousSlug?.trim();
  if (slug) revalidateTag(productSlugTag(slug), "max");
  if (previousSlug && previousSlug !== slug) {
    revalidateTag(productSlugTag(previousSlug), "max");
  }
}

export function revalidateProductReviews(productId: string): void {
  revalidateTag(productReviewsTag(productId), "max");
  revalidateTag(HOME_PAGE_TAG, "max");
}

export async function revalidateProductById(productId: string): Promise<void> {
  revalidateProductReviews(productId);
  const row = await prisma.products.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  revalidateProductCatalog({ slug: row?.slug ?? undefined });
}

export async function revalidateProductReviewsByReviewId(reviewId: string): Promise<void> {
  const row = await prisma.reviews.findUnique({
    where: { id: reviewId },
    select: { product_id: true },
  });
  if (row?.product_id) revalidateProductReviews(row.product_id);
  else revalidateTag(HOME_PAGE_TAG, "max");
}

/** Category tree, nav, shop facets, home tiles fallback. */
export function revalidateCategoryCatalog(): void {
  revalidateTags(CATEGORIES_TAG, SHOP_LISTING_TAG, PRODUCT_CATALOG_TAG, HEADER_NAV_TAG, HOME_PAGE_TAG);
  revalidateStorePaths({ includeLayout: true });
}

/** Brand nav + shop brand facets + home brand rail references. */
export function revalidateBrandCatalog(): void {
  revalidateTags(BRANDS_TAG, HEADER_NAV_TAG, SHOP_LISTING_TAG, HOME_PAGE_TAG);
  revalidatePath(STORE_PATHS.shop);
  revalidatePath(STORE_PATHS.home);
}

/** Subtypes, collections, product types — shop filters only. */
export function revalidateShopTaxonomy(): void {
  revalidateTags(SHOP_LISTING_TAG);
  revalidatePath(STORE_PATHS.shop);
}

/** Settings, chrome, announcements, layout shell, home overlay copy. */
export function revalidateMarketingSite(): void {
  revalidateTags(MARKETING_TAG, ANNOUNCEMENTS_TAG, HEADER_NAV_TAG, HOME_PAGE_TAG, POPUPS_TAG);
  revalidateStorePaths({ includeLayout: true });
}

export function revalidateAnnouncements(): void {
  revalidateTags(ANNOUNCEMENTS_TAG);
  revalidatePath(STORE_PATHS.siteLayout, "layout");
}

export function revalidatePopups(): void {
  revalidateTags(POPUPS_TAG, MARKETING_TAG);
}

export async function revalidateFlashSales(options?: {
  productId?: string;
  productSlug?: string;
}): Promise<void> {
  revalidateTags(FLASH_SALES_TAG, PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG, HOME_PAGE_TAG);
  revalidatePath(STORE_PATHS.shop);
  revalidatePath(STORE_PATHS.home);

  let slug = options?.productSlug?.trim();
  if (!slug && options?.productId) {
    const row = await prisma.products.findUnique({
      where: { id: options.productId },
      select: { slug: true },
    });
    slug = row?.slug ?? undefined;
  }
  if (slug) {
    revalidateTag(productSlugTag(slug), "max");
    revalidatePath(STORE_PATHS.product(slug));
  }
}

/** Inventory quantity affects shop availability + product cards. */
export function revalidateInventoryCatalog(options?: { productId?: string }): void {
  if (options?.productId) {
    void revalidateProductById(options.productId);
    return;
  }
  revalidateProductCatalog();
}

export function revalidateSitemap(): void {
  revalidatePath("/sitemap.xml");
}
