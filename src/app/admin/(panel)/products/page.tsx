import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/utils/formatePrice";
import { AdminPagination } from "@/components/admin/AdminPagination";

export const metadata = {
  title: "Admin Products | i-Robox",
};

const PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const total = await prisma.products.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rawPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const products = await prisma.products.findMany({
    orderBy: { updated_at: "desc" },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      slug: true,
      base_price: true,
      discounted_price: true,
      is_active: true,
      created_at: true,
      diecast_scales: { select: { ratio: true } },
    },
  });

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + products.length;

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

      {total > 0 ? (
        <p className="text-sm text-meta-3">
          Showing {rangeStart}–{rangeEnd} of {total}
          {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : null}
        </p>
      ) : null}

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Scale</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Active</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-gray-3">
                <td className="py-3 px-4">
                  <div className="font-semibold text-dark">{p.name}</div>
                  <div className="text-xs text-meta-4">{p.slug}</div>
                </td>
                <td className="py-3 px-4 text-meta-3 text-sm">
                  {p.diecast_scales?.ratio ?? "—"}
                </td>
                <td className="py-3 px-4 text-dark">
                  {formatPrice(Number(p.discounted_price ?? p.base_price))}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-xs rounded-full border px-3 py-1 ${
                      p.is_active
                        ? "bg-gray-1 border-gray-3 text-dark"
                        : "bg-white border-gray-3 text-meta-3"
                    }`}
                  >
                    {p.is_active ? "Yes" : "No"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="text-sm font-medium text-blue hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={5}>
                  No products yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        pathname="/admin/products"
      />
    </div>
  );
}
