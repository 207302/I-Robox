import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { paginateDiscountFilteredProductIds } from "@/lib/shop/shopFacets";
import { loadListingFacets, type ListingFacetsBundle } from "@/lib/shop/shopListingFacets";
import {
  createShopListingProfile,
  finishShopListingProfile,
  profiledQuery,
} from "@/lib/shop/shopListingProfile";
import type { ShopListingRequestOptions } from "@/lib/shop/shopListingParams";
import {
  prepareShopListingRequest,
  type ShopListingReadyState,
} from "@/lib/shop/shopListingPrepare";

export type ShopListingItem = {
  id: string;
  title: string;
  image: string;
  shortDescription: string;
  description: string;
  ageGroup: string | null;
  diecastScale: string | null;
  price: number;
  discountedPrice: number | null;
  shippingPerUnit: number;
  slug: string;
  quantity: number;
  updatedAt: Date;
  reviews: number;
  product_images: { url: string; sort_order: number }[];
  productVariants: {
    id: string;
    name?: string;
    color: string;
    size: string;
    isDefault: boolean;
    image: string;
  }[];
};

export type ShopListingData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  ageGroups: string[];
  diecastScales: string[];
  brands: { slug: string; name: string; count: number }[];
  productSubtypes: { slug: string; name: string; count: number }[];
  productCollections: { slug: string; name: string; count: number }[];
  discountBuckets: { id: string; label: string; count: number }[];
  items: ShopListingItem[];
};

export function mergeShopListingData(
  listing: Pick<ShopListingData, "page" | "pageSize" | "total" | "totalPages" | "items">,
  facets: ListingFacetsBundle
): ShopListingData {
  return { ...listing, ...facets };
}

function mapProductsToItems(
  products: {
    id: string;
    name: string;
    short_description: string | null;
    base_price: { toString(): string } | number;
    discounted_price: { toString(): string } | number | null;
    age_group: string | null;
    diecast_scales: { ratio: string } | null;
    slug: string;
    updated_at: Date;
    sku: string | null;
    shipping_per_unit: { toString(): string } | number | null;
    product_images: { url: string; sort_order: number }[];
    product_variants: {
      name: string | null;
      color: string | null;
      size: string | null;
      is_default: boolean;
      product_images: { url: string }[];
    }[];
    inventory: { available_quantity: number }[];
  }[],
  flashMap: Map<string, number>
): ShopListingItem[] {
  return products.map((p) => {
    const images = p.product_images.slice().sort((a, b) => a.sort_order - b.sort_order);
    const image = images[0]?.url ?? "";
    const quantity = p.inventory.reduce((sum, r) => sum + r.available_quantity, 0);
    const flashPrice = flashMap.get(p.id);
    const basePrice = Number(p.base_price);
    const regularDiscounted = p.discounted_price ? Number(p.discounted_price) : null;
    const effectiveDiscounted = flashPrice ?? regularDiscounted;
    return {
      id: p.id,
      title: p.name,
      image,
      shortDescription: p.short_description ?? "",
      description: "",
      ageGroup: p.age_group ?? null,
      diecastScale: p.diecast_scales?.ratio ?? null,
      price: basePrice,
      discountedPrice: effectiveDiscounted,
      shippingPerUnit: Number(p.shipping_per_unit ?? 0),
      slug: p.slug,
      quantity,
      updatedAt: p.updated_at,
      reviews: 0,
      product_images: images,
      productVariants: p.product_variants.map((v) => ({
        id: v.id,
        name: v.name ?? "",
        color: v.color ?? "",
        size: v.size ?? "",
        isDefault: v.is_default,
        image: v.product_images[0]?.url ?? image,
      })),
    };
  });
}

export type ShopListingResult =
  | { ok: true; data: ShopListingData }
  | { ok: false; error: string; status: number };

/**
 * Shared shop listing (used by GET /api/products and the Shop server page).
 * Avoids internal HTTP fetches so localhost always uses the same DB as Prisma.
 */
const emptyFacetsBundle: ListingFacetsBundle = {
  ageGroups: [],
  diecastScales: [],
  brands: [],
  productSubtypes: [],
  productCollections: [],
  discountBuckets: [],
};

async function executeShopListingFromState(
  state: ShopListingReadyState,
  requestOptions?: Pick<ShopListingRequestOptions, "knownTotal" | "skipFlashSales">
): Promise<Pick<ShopListingData, "page" | "pageSize" | "total" | "totalPages" | "items">> {
  const {
    where,
    orderBy,
    page,
    pageSize,
    skip,
    discountParams,
    sortPrice,
    now,
    searchIdOrder,
    facetCtx,
  } = state;
  const { profile } = facetCtx;

  const listingSelect = {
    id: true,
    name: true,
    short_description: true,
    base_price: true,
    discounted_price: true,
    age_group: true,
    diecast_scales: { select: { ratio: true } },
    slug: true,
    updated_at: true,
    sku: true,
    shipping_per_unit: true,
    product_images: { select: { url: true, sort_order: true } },
    product_variants: {
      select: {
        id: true,
        name: true,
        color: true,
        size: true,
        is_default: true,
        product_images: { select: { url: true }, orderBy: { sort_order: "asc" as const }, take: 1 },
      },
    },
    inventory: { select: { available_quantity: true } },
  } as const;

  let total: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: any[];

  if (discountParams.length > 0) {
    const candidateRows = await profiledQuery(profile, "listing.discountCandidates", () =>
      prisma.products.findMany({
        where: where as never,
        select: { id: true },
      })
    );
    const candidateIds = candidateRows.map((r) => r.id);
    const sortPriceKey =
      sortPrice === "price_asc" ? "price_asc" : sortPrice === "price_desc" ? "price_desc" : null;
    const { ids: pageIds, total: discountTotal } = await profiledQuery(
      profile,
      "listing.discountPaginate",
      () =>
        paginateDiscountFilteredProductIds({
          candidateIds,
          discountKeys: discountParams,
          skip,
          take: pageSize,
          sortPrice: sortPriceKey,
        })
    );
    total = discountTotal;
    if (pageIds.length === 0) {
      products = [];
    } else {
      const reordered = await profiledQuery(profile, "listing.discountPage", () =>
        prisma.products.findMany({
          where: { id: { in: pageIds } },
          select: listingSelect,
        })
      );
      const order = new Map(pageIds.map((id, i) => [id, i] as const));
      reordered.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      products = reordered;
    }
  } else if (searchIdOrder?.length && !sortPrice) {
    const candidateRows = await profiledQuery(profile, "listing.fuzzyIdFilter", () =>
      prisma.products.findMany({
        where: where as never,
        select: { id: true },
      })
    );
    const allowed = new Set(candidateRows.map((r) => r.id));
    const ordered = searchIdOrder.filter((id) => allowed.has(id));
    total = ordered.length;
    const pageIds = ordered.slice(skip, skip + pageSize);
    if (pageIds.length === 0) {
      products = [];
    } else {
      const reordered = await profiledQuery(profile, "listing.fuzzyIdPage", () =>
        prisma.products.findMany({
          where: { id: { in: pageIds } },
          select: listingSelect,
        })
      );
      const order = new Map(pageIds.map((id, i) => [id, i] as const));
      reordered.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      products = reordered;
    }
  } else {
    const skipCount =
      requestOptions?.knownTotal != null &&
      requestOptions.knownTotal >= 0 &&
      discountParams.length === 0 &&
      !searchIdOrder?.length;

    if (skipCount) {
      total = requestOptions.knownTotal!;
      products = await profiledQuery(profile, "listing.page", () =>
        prisma.products.findMany({
          where: where as never,
          orderBy,
          skip,
          take: pageSize,
          select: listingSelect,
        })
      );
    } else {
      const [c, prows] = await Promise.all([
        profiledQuery(profile, "listing.count", () =>
          prisma.products.count({ where: where as never })
        ),
        profiledQuery(profile, "listing.page", () =>
          prisma.products.findMany({
            where: where as never,
            orderBy,
            skip,
            take: pageSize,
            select: listingSelect,
          })
        ),
      ]);
      total = c;
      products = prows;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let effectivePage = page;
  if (total > 0 && page > totalPages) {
    effectivePage = totalPages;
    const correctedSkip = (effectivePage - 1) * pageSize;
    if (discountParams.length > 0) {
      const candidateRows = await profiledQuery(profile, "listing.discountCandidates", () =>
        prisma.products.findMany({
          where: where as never,
          select: { id: true },
        })
      );
      const candidateIds = candidateRows.map((r) => r.id);
      const sortPriceKey =
        sortPrice === "price_asc" ? "price_asc" : sortPrice === "price_desc" ? "price_desc" : null;
      const { ids: pageIds } = await profiledQuery(profile, "listing.discountPaginate", () =>
        paginateDiscountFilteredProductIds({
          candidateIds,
          discountKeys: discountParams,
          skip: correctedSkip,
          take: pageSize,
          sortPrice: sortPriceKey,
        })
      );
      if (pageIds.length === 0) {
        products = [];
      } else {
        const reordered = await profiledQuery(profile, "listing.discountPage", () =>
          prisma.products.findMany({
            where: { id: { in: pageIds } },
            select: listingSelect,
          })
        );
        const order = new Map(pageIds.map((id, i) => [id, i] as const));
        reordered.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        products = reordered;
      }
    } else if (searchIdOrder?.length && !sortPrice) {
      const candidateRows = await profiledQuery(profile, "listing.fuzzyIdFilter", () =>
        prisma.products.findMany({
          where: where as never,
          select: { id: true },
        })
      );
      const allowed = new Set(candidateRows.map((r) => r.id));
      const ordered = searchIdOrder.filter((id) => allowed.has(id));
      const pageIds = ordered.slice(correctedSkip, correctedSkip + pageSize);
      if (pageIds.length === 0) {
        products = [];
      } else {
        const reordered = await profiledQuery(profile, "listing.fuzzyIdPage", () =>
          prisma.products.findMany({
            where: { id: { in: pageIds } },
            select: listingSelect,
          })
        );
        const order = new Map(pageIds.map((id, i) => [id, i] as const));
        reordered.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        products = reordered;
      }
    } else {
      products = await profiledQuery(profile, "listing.page", () =>
        prisma.products.findMany({
          where: where as never,
          orderBy,
          skip: correctedSkip,
          take: pageSize,
          select: listingSelect,
        })
      );
    }
  }

  const productIds = products.map((p) => p.id);
  const flashMap = new Map<string, number>();
  if (!requestOptions?.skipFlashSales && productIds.length > 0) {
    const flashRows = await profiledQuery(profile, "listing.flashSales", () =>
      prisma.flash_sale_products.findMany({
        where: { product_id: { in: productIds }, is_active: true },
        select: {
          product_id: true,
          sale_price: true,
          is_active: true,
          active_from: true,
          active_until: true,
        },
      })
    );
    for (const row of flashRows) {
      if (isActiveInWindow(row.is_active, row.active_from, row.active_until, now)) {
        flashMap.set(row.product_id, Number(row.sale_price));
      }
    }
  }

  const finalItems = mapProductsToItems(products, flashMap);

  return {
    page: effectivePage,
    pageSize,
    total,
    totalPages,
    items: finalItems,
  };
}

export async function getShopListing(
  usp: URLSearchParams,
  requestOptions?: Partial<ShopListingRequestOptions>
): Promise<ShopListingResult> {
  const includeFacets = requestOptions?.includeFacets !== false;
  const profile = createShopListingProfile();
  const startedAt = profile.startedAt;

  const prep = await prepareShopListingRequest(usp, profile);
  if (prep.kind === "error") {
    return prep.result;
  }
  if (prep.kind === "complete") {
    return { ok: true, data: prep.data as ShopListingData };
  }

  const { state } = prep;
  const facets = includeFacets
    ? await loadListingFacets(state.facetCacheParams, state.facetCtx)
    : emptyFacetsBundle;

  const listing = await executeShopListingFromState(state, {
    knownTotal: requestOptions?.knownTotal,
    skipFlashSales: requestOptions?.skipFlashSales,
  });

  finishShopListingProfile(profile, {
    ok: true,
    total: listing.total,
    page: listing.page,
    pageSize: listing.pageSize,
    hasSearch: Boolean(state.q),
    categoryCount: state.categorySlugs.length,
    discountFilter: state.discountParams.length > 0,
    elapsedMs: Date.now() - startedAt,
  });

  return { ok: true, data: mergeShopListingData(listing, facets) };
}
