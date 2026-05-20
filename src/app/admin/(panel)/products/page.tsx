import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";
import type { ProductSearchItem as AdminProductSearchItem } from "@/lib/search/productSearch";

export const metadata = {
  title: "Admin Products | i-Robox",
};

export default async function AdminProductsPage() {
  const rows = await prisma.products.findMany({
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      base_price: true,
      discounted_price: true,
      is_active: true,
      brands: { select: { name: true } },
      categories: { select: { name: true } },
      product_subtypes: { select: { name: true } },
      product_types: { select: { name: true } },
      product_collections: { select: { name: true } },
      diecast_scales: { select: { ratio: true } },
    },
  });

  const products: AdminProductSearchItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    basePrice: Number(p.base_price),
    discountedPrice: p.discounted_price != null ? Number(p.discounted_price) : null,
    isActive: p.is_active,
    scale: p.diecast_scales?.ratio ?? null,
    brand: p.brands?.name ?? null,
    category: p.categories?.name ?? null,
    subcategory: p.product_subtypes?.name ?? null,
    productType: p.product_types?.name ?? null,
    collection: p.product_collections?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-dark">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition"
        >
          New product
        </Link>
      </div>

      <AdminProductsTable products={products} />
    </div>
  );
}
