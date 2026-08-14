import { prisma } from "@/lib/prisma";
import type { ProductSearchItem } from "@/lib/search/productSearch";

const searchIndexSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  is_active: true,
  brands: { select: { name: true } },
  categories: { select: { name: true } },
  product_subtypes: { select: { name: true } },
  product_types: { select: { name: true } },
  product_collections: { select: { name: true } },
  diecast_scales: { select: { ratio: true } },
} as const;

function mapSearchIndexRow(p: {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  is_active?: boolean;
  brands: { name: string } | null;
  categories: { name: string } | null;
  product_subtypes: { name: string } | null;
  product_types: { name: string } | null;
  product_collections: { name: string } | null;
  diecast_scales: { ratio: string } | null;
}): ProductSearchItem {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    brand: p.brands?.name ?? null,
    category: p.categories?.name ?? null,
    subcategory: p.product_subtypes?.name ?? null,
    productType: p.product_types?.name ?? null,
    collection: p.product_collections?.name ?? null,
    scale: p.diecast_scales?.ratio ?? null,
    isActive: p.is_active ?? true,
  };
}

export async function loadShopProductSearchIndex(): Promise<ProductSearchItem[]> {
  const rows = await prisma.products.findMany({
    where: { is_active: true },
    orderBy: { updated_at: "desc" },
    take: 10_000, // index ceiling — fuzzy search covers top 10k active products by recency
    select: searchIndexSelect,
  });
  return rows.map(mapSearchIndexRow);
}

/** Admin allow-lists: active and inactive products. */
export async function loadAdminProductSearchIndex(): Promise<ProductSearchItem[]> {
  const rows = await prisma.products.findMany({
    orderBy: { updated_at: "desc" },
    take: 10_000,
    select: searchIndexSelect,
  });
  return rows.map(mapSearchIndexRow);
}
