import { prisma } from "@/lib/prisma";
import type { ProductSearchItem } from "@/lib/search/productSearch";

export async function loadShopProductSearchIndex(): Promise<ProductSearchItem[]> {
  const rows = await prisma.products.findMany({
    where: { is_active: true },
    orderBy: { updated_at: "desc" },
    take: 10_000, // index ceiling — fuzzy search covers top 10k active products by recency
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      brands: { select: { name: true } },
      categories: { select: { name: true } },
      product_subtypes: { select: { name: true } },
      product_types: { select: { name: true } },
      product_collections: { select: { name: true } },
      diecast_scales: { select: { ratio: true } },
    },
  });

  return rows.map((p) => ({
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
  }));
}
