import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { flashSaleUnitPriceForProduct } from "@/lib/pricing/flashSale";
import { Prisma } from "@prisma/client";
import { PRODUCT_PAGE_REVALIDATE_SECONDS } from "@/lib/cache/constants";
import { ORDERS_TAG, PRODUCT_CATALOG_TAG, productSlugTag } from "@/lib/cache/tags";
import { onCacheMiss } from "@/lib/observability/cache";

const pickDefaultImage = (product: {
  product_images?: { url: string; sort_order: number }[];
}) => {
  const images = product.product_images ?? [];
  if (images.length === 0) return "";
  return images.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? "";
};

const getInventoryQuantity = (inventory: { available_quantity: number }[] = []) =>
  inventory.reduce((sum, row) => sum + Number(row.available_quantity || 0), 0);

const approvedReviewsSelect = {
  where: { is_approved: true },
  select: { rating: true },
} as const;

function reviewStatsFromRows(reviews: { rating: number }[] | undefined) {
  const rows = reviews ?? [];
  if (rows.length === 0) return { averageRating: null as number | null, reviewCount: 0 };
  const total = rows.reduce((sum, row) => sum + row.rating, 0);
  return { averageRating: total / rows.length, reviewCount: rows.length };
}

// get new arrival products (homepage)
export const getNewArrivalsProduct = unstable_cache(
  onCacheMiss("new-arrivals-products", async () => {
    const products = await prisma.products.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        short_description: true,
        base_price: true,
        discounted_price: true,
        slug: true,
        diecast_scales: { select: { ratio: true } },
        created_at: true,
        updated_at: true,
        product_variants: {
          select: {
            id: true,
            name: true,
            color: true,
            size: true,
            is_default: true,
            product_images: {
              orderBy: { sort_order: "asc" },
              take: 1,
              select: { url: true },
            },
          }
        },
        inventory: { select: { available_quantity: true } },
        product_images: { select: { url: true, sort_order: true } },
        reviews: approvedReviewsSelect,
        sku: true,
        shipping_per_unit: true,
        max_order_quantity: true,
        brand_id: true,
      },
      take: 10
    });
    return products.map((item) => {
      const { averageRating, reviewCount } = reviewStatsFromRows(item.reviews);
      return {
      id: item.id,
      title: item.name,
      shortDescription: item.short_description ?? "",
      description: "",
      body: "",
      price: Number(item.base_price),
      discountedPrice: item.discounted_price ? Number(item.discounted_price) : null,
      slug: item.slug,
      quantity: getInventoryQuantity(item.inventory),
      maxOrderQuantity: item.max_order_quantity ?? 99,
      brandId: item.brand_id ?? null,
      sku: item.sku ?? "",
      shippingPerUnit: Number(item.shipping_per_unit ?? 0),
      diecastScale: item.diecast_scales?.ratio ?? null,
      tags: [],
      offers: "",
      updatedAt: item.updated_at,
      product_images: item.product_images,
      productVariants: item.product_variants.map((v) => ({
        id: v.id,
        image: v.product_images[0]?.url ?? pickDefaultImage(item),
        name: v.name ?? "",
        color: v.color ?? "",
        size: v.size ?? "",
        isDefault: v.is_default,
      })),
      reviews: reviewCount,
      averageRating,
      reviewCount,
    };
    });
  }),
  ["new-arrivals-products", "v3"],
  { revalidate: 300, tags: [PRODUCT_CATALOG_TAG] }
);

const bestSellerProductSelect = {
  id: true,
  name: true,
  short_description: true,
  base_price: true,
  discounted_price: true,
  slug: true,
  diecast_scales: { select: { ratio: true } },
  updated_at: true,
  product_variants: {
    select: {
      id: true,
      name: true,
      color: true,
      size: true,
      is_default: true,
      product_images: {
        orderBy: { sort_order: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  },
  inventory: { select: { available_quantity: true } },
  product_images: { select: { url: true, sort_order: true } },
  sku: true,
  shipping_per_unit: true,
  max_order_quantity: true,
  brand_id: true,
  reviews: approvedReviewsSelect,
} satisfies Prisma.productsSelect;

type BestSellerProductRow = Prisma.productsGetPayload<{
  select: typeof bestSellerProductSelect;
}>;

const mapProductToHomeCard = (item: BestSellerProductRow) => {
  const { averageRating, reviewCount } = reviewStatsFromRows(item.reviews);
  return {
  id: item.id,
  title: item.name,
  shortDescription: item.short_description ?? "",
  description: "",
  body: "",
  price: Number(item.base_price),
  discountedPrice: item.discounted_price ? Number(item.discounted_price) : null,
  slug: item.slug,
  quantity: getInventoryQuantity(item.inventory),
  maxOrderQuantity: item.max_order_quantity ?? 99,
  brandId: item.brand_id ?? null,
  sku: item.sku ?? "",
  shippingPerUnit: Number(item.shipping_per_unit ?? 0),
  diecastScale: item.diecast_scales?.ratio ?? null,
  tags: [],
  offers: "",
  updatedAt: item.updated_at,
  product_images: item.product_images,
  productVariants: item.product_variants.map((v) => ({
    id: v.id,
    image: v.product_images[0]?.url ?? pickDefaultImage(item),
    name: v.name ?? "",
    color: v.color ?? "",
    size: v.size ?? "",
    isDefault: v.is_default,
  })),
  reviews: reviewCount,
  averageRating,
  reviewCount,
};
};

// get best selling products (by total quantity on payment-succeeded orders)
export const getBestSellingProducts = unstable_cache(
  onCacheMiss("best-selling-products", async () => {
    /**
     * Rank by summed `order_items.quantity` for orders that have actually captured
     * payment successfully. This avoids relying on `orders.status` alone, which can
     * lag or diverge depending on fulfillment/shipping updates.
     */
    const soldRows = await prisma.$queryRaw<Array<{ product_id: string; qty: bigint }>>(
      Prisma.sql`
        SELECT
          oi.product_id AS product_id,
          SUM(oi.quantity)::bigint AS qty
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'SUCCEEDED'
          AND o.status NOT IN ('CANCELLED', 'PAYMENT_FAILED', 'REFUNDED')
        GROUP BY oi.product_id
        ORDER BY qty DESC
        LIMIT 8
      `
    );

    const rankedIds = soldRows
      .map((row) => ({
        id: row.product_id,
        qty: Number(row.qty),
      }))
      .filter((row) => Number.isFinite(row.qty) && row.qty > 0)
      .map((row) => row.id);

    if (rankedIds.length === 0) {
      const fallback = await prisma.products.findMany({
        where: { is_active: true },
        select: bestSellerProductSelect,
        orderBy: { updated_at: "desc" },
        take: 8,
      });
      return fallback.map(mapProductToHomeCard);
    }

    const rows = await prisma.products.findMany({
      where: { id: { in: rankedIds }, is_active: true },
      select: bestSellerProductSelect,
    });
    const byId = new Map(rows.map((p) => [p.id, p]));
    const ordered = rankedIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => p != null)
      .slice(0, 8);

    return ordered.map(mapProductToHomeCard);
  }),
  ["best-selling-products", "v3"],
  { revalidate: 300, tags: [PRODUCT_CATALOG_TAG, ORDERS_TAG] }
);

export type ProductBySlug = NonNullable<Awaited<ReturnType<typeof loadProductBySlug>>>;

async function loadProductBySlug(slug: string) {
  const product = await prisma.products.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      short_description: true,
      description: true,
      base_price: true,
      discounted_price: true,
      age_group: true,
      diecast_scales: { select: { ratio: true } },
      slug: true,
      is_active: true,
      updated_at: true,
      brand_id: true,
      categories: {
        select: {
          slug: true,
          name: true,
        },
      },
      brands: {
        select: {
          slug: true,
          name: true,
        },
      },
      product_subtypes: {
        select: {
          slug: true,
          name: true,
        },
      },
      product_collections: {
        select: {
          slug: true,
          name: true,
        },
      },
      product_variants: {
        orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
        select: {
          id: true,
          name: true,
          color: true,
          size: true,
          is_default: true,
          product_images: {
            orderBy: { sort_order: "asc" },
            select: { url: true },
          },
        },
      },
      product_images: { select: { url: true, sort_order: true, product_variant_id: true } },
      inventory: { select: { available_quantity: true } },
      sku: true,
      shipping_per_unit: true,
      max_order_quantity: true,
    },
  });
  if (!product || !product.is_active) return null;
  const flashPrice = await flashSaleUnitPriceForProduct(product);
  return {
    id: product.id,
    title: product.name,
    shortDescription: product.short_description ?? "",
    ageGroup: product.age_group ?? null,
    diecastScale: product.diecast_scales?.ratio ?? null,
    description: product.description ?? "",
    body: "",
    price: Number(product.base_price),
    discountedPrice: flashPrice ?? (product.discounted_price ? Number(product.discounted_price) : null),
    slug: product.slug,
    quantity: getInventoryQuantity(product.inventory),
    maxOrderQuantity: product.max_order_quantity ?? 99,
    brandId: product.brand_id ?? null,
    sku: product.sku ?? "",
    shippingPerUnit: Number(product.shipping_per_unit ?? 0),
    tags: [],
    offers: "",
    updatedAt: product.updated_at,
    category: product.categories
      ? { title: product.categories.name, slug: product.categories.slug }
      : null,
    brand: product.brands
      ? { name: product.brands.name, slug: product.brands.slug }
      : null,
    subcategory: product.product_subtypes
      ? { name: product.product_subtypes.name, slug: product.product_subtypes.slug }
      : null,
    collection: product.product_collections
      ? { name: product.product_collections.name, slug: product.product_collections.slug }
      : null,
    product_images: product.product_images,
    productVariants: product.product_variants.map((v) => {
      const images = v.product_images.map((p) => p.url).filter(Boolean);
      const fallback = pickDefaultImage(product);
      return {
        id: v.id,
        images,
        image: images[0] ?? fallback,
        name: v.name ?? "",
        color: v.color ?? "",
        size: v.size ?? "",
        isDefault: v.is_default,
      };
    }),
    reviews: 0,
    additionalInformation: [],
    customAttributes: [],
  };
}

/**
 * Cached PDP loader — dedupes `generateMetadata` + page within one request;
 * revalidates every 5 minutes or via `revalidateTag` after admin edits.
 */
export function getProductBySlug(slug: string): Promise<ProductBySlug | null> {
  const normalized = slug.trim();
  if (!normalized) return Promise.resolve(null);

  return unstable_cache(
    onCacheMiss(`product-by-slug:${normalized}`, () => loadProductBySlug(normalized)),
    ["product-by-slug", normalized],
    {
      revalidate: PRODUCT_PAGE_REVALIDATE_SECONDS,
      tags: [PRODUCT_CATALOG_TAG, productSlugTag(normalized)],
    }
  )();
}
