import { prisma } from "@/lib/prisma";
import { AdminInventoryTable, type AdminInventoryRow } from "@/components/admin/AdminInventoryTable";
import type { ProductSearchItem } from "@/lib/search/productSearch";

export const metadata = {
  title: "Admin Inventory | i-Robox",
};

function productSearchFields(p: {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
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
  };
}

const productSelect = {
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

export default async function AdminInventoryPage() {
  const invRows = await prisma.inventory.findMany({
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      product_id: true,
      product_variant_id: true,
      available_quantity: true,
      reserved_quantity: true,
      sold_quantity: true,
      low_stock_threshold: true,
      products: { select: productSelect },
    },
  });

  const productsWithNoInventory = await prisma.products.findMany({
    where: { inventory: { none: {} } },
    select: productSelect,
  });

  const inventoryRows: AdminInventoryRow[] = invRows
    .filter((r) => r.products)
    .map((r) => {
      const p = r.products!;
      return {
        id: r.id,
        productId: r.product_id,
        productVariantId: r.product_variant_id,
        availableQuantity: r.available_quantity,
        reservedQuantity: r.reserved_quantity,
        soldQuantity: r.sold_quantity,
        lowStockThreshold: r.low_stock_threshold,
        pending: false,
        isActive: p.is_active,
        search: productSearchFields(p),
      };
    });

  const pendingRows: AdminInventoryRow[] = productsWithNoInventory.map((p) => ({
    id: `pending-${p.id}`,
    productId: p.id,
    productVariantId: null,
    availableQuantity: 0,
    reservedQuantity: 0,
    soldQuantity: 0,
    lowStockThreshold: 5,
    pending: true,
    isActive: p.is_active,
    search: productSearchFields(p),
  }));

  const rows = [...inventoryRows, ...pendingRows].sort((a, b) =>
    a.search.name.localeCompare(b.search.name, undefined, { sensitivity: "base" })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Inventory</h1>

      <p className="text-sm text-meta-3 max-w-2xl">
        Includes <b className="text-dark">inactive</b> products. Rows are red when available quantity is{" "}
        <b className="text-dark">below</b> the low-stock threshold (or out of stock). Products with no inventory record
        yet appear as 0 / threshold 5 — use Edit to open the product or inventory screen.
      </p>

      <AdminInventoryTable rows={rows} />
    </div>
  );
}
