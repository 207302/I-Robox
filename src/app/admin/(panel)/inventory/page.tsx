import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Admin Inventory | i-Robox",
};

function isBelowThreshold(available: number, threshold: number) {
  return available === 0 || available < threshold;
}

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
      products: { select: { name: true, sku: true, slug: true, is_active: true } },
    },
  });

  const productsWithNoInventory = await prisma.products.findMany({
    where: { inventory: { none: {} } },
    select: { id: true, name: true, sku: true, slug: true, is_active: true },
  });

  const synthetic = productsWithNoInventory.map((p) => ({
    id: `pending-${p.id}`,
    product_id: p.id,
    product_variant_id: null,
    available_quantity: 0,
    reserved_quantity: 0,
    sold_quantity: 0,
    low_stock_threshold: 5,
    products: { name: p.name, sku: p.sku, slug: p.slug, is_active: p.is_active },
    _pending: true as const,
  }));

  const rows = [...invRows, ...synthetic].sort((a, b) => {
    const na = a.products?.name ?? "";
    const nb = b.products?.name ?? "";
    return na.localeCompare(nb, undefined, { sensitivity: "base" });
  });

  const lowStock = rows.filter((r) => isBelowThreshold(r.available_quantity, r.low_stock_threshold));
  const outOfStock = rows.filter((r) => r.available_quantity === 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Inventory</h1>
      <p className="text-sm text-meta-3 max-w-2xl">
        Includes <b className="text-dark">inactive</b> products. Rows are red when available quantity is{" "}
        <b className="text-dark">below</b> the low-stock threshold (or out of stock). Products with no inventory record
        yet appear as 0 / threshold 5 — use Edit to open the product or inventory screen.
      </p>

      {/* Alert banners */}
      {outOfStock.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
          <p className="font-semibold">
            🚫 {outOfStock.length} line{outOfStock.length !== 1 ? "s" : ""} out of stock
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {outOfStock.map((r) => (
              <li key={r.id}>
                <Link
                  href={"_pending" in r && r._pending ? `/admin/products/${r.product_id}` : `/admin/inventory/${r.id}`}
                  className="underline hover:no-underline"
                >
                  {r.products?.name ?? "Unknown"}
                  {r.products?.sku ? ` (${r.products.sku})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lowStock.length > 0 && outOfStock.length < lowStock.length && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
          <p className="font-semibold">
            ⚠️ {lowStock.length} line{lowStock.length !== 1 ? "s" : ""} below low-stock threshold
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {lowStock
              .filter((r) => r.available_quantity > 0)
              .map((r) => (
                <li key={r.id}>
                  <Link
                    href={
                      "_pending" in r && r._pending ? `/admin/products/${r.product_id}` : `/admin/inventory/${r.id}`
                    }
                    className="underline hover:no-underline"
                  >
                    {r.products?.name ?? "Unknown"}
                    {r.products?.sku ? ` (${r.products.sku})` : ""}
                  </Link>
                  {" "}
                  — {r.available_quantity} left (threshold: {r.low_stock_threshold})
                </li>
              ))}
          </ul>
        </div>
      )}

      {lowStock.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Nothing is below its low-stock threshold.
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Store</th>
              <th className="py-3 px-4">Available</th>
              <th className="py-3 px-4">Reserved</th>
              <th className="py-3 px-4">Sold</th>
              <th className="py-3 px-4">Threshold</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Edit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isRed = isBelowThreshold(r.available_quantity, r.low_stock_threshold);
              const isOut = r.available_quantity === 0;
              const pending = "_pending" in r && r._pending;
              return (
                <tr key={r.id} className={`border-b border-gray-3 ${isRed ? "bg-red-50" : ""}`}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-dark">{r.products?.name ?? "—"}</div>
                    <div className="text-xs text-meta-4">{r.products?.sku ?? ""}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs rounded-full border px-3 py-1 ${
                        r.products?.is_active
                          ? "bg-gray-1 border-gray-3 text-dark"
                          : "bg-white border-gray-3 text-meta-3"
                      }`}
                    >
                      {r.products?.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={`py-3 px-4 font-semibold ${isRed ? "text-red-600" : "text-dark"}`}>
                    {r.available_quantity}
                  </td>
                  <td className={`py-3 px-4 ${isRed ? "text-red-700/90" : "text-dark"}`}>{r.reserved_quantity}</td>
                  <td className={`py-3 px-4 ${isRed ? "text-red-700/90" : "text-dark"}`}>{r.sold_quantity}</td>
                  <td className={`py-3 px-4 ${isRed ? "text-red-700/90" : "text-dark"}`}>{r.low_stock_threshold}</td>
                  <td className="py-3 px-4">
                    {isOut ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Out of stock
                      </span>
                    ) : isRed ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Below threshold
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      className="text-sm font-medium text-blue hover:underline"
                      href={pending ? `/admin/products/${r.product_id}` : `/admin/inventory/${r.id}`}
                    >
                      {pending ? "Set stock" : "Edit"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={8}>
                  No inventory rows found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
