import Link from "next/link";
import { AdminCouponDeleteButton } from "@/components/admin/AdminCouponDeleteButton";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Admin Coupons | i-Robox",
};

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupons.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      discount_type: true,
      discount_value: true,
      min_cart_value: true,
      starts_at: true,
      ends_at: true,
      is_active: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-dark">Coupons</h1>
        <Link
          href="/admin/coupons/new"
          className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition"
        >
          New coupon
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Value</th>
              <th className="py-3 px-4">Min cart</th>
              <th className="py-3 px-4">Active</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-gray-3">
                <td className="py-3 px-4">
                  <div className="font-semibold text-dark">{c.code}</div>
                  <div className="text-xs text-meta-4">
                    {c.starts_at ? `From ${new Date(c.starts_at).toLocaleDateString()}` : "No start"}
                    {" · "}
                    {c.ends_at ? `To ${new Date(c.ends_at).toLocaleDateString()}` : "No end"}
                  </div>
                </td>
                <td className="py-3 px-4 text-dark">{c.discount_type}</td>
                <td className="py-3 px-4 text-dark">{String(c.discount_value)}</td>
                <td className="py-3 px-4 text-dark">{c.min_cart_value ? String(c.min_cart_value) : "—"}</td>
                <td className="py-3 px-4 text-dark">{c.is_active ? "Yes" : "No"}</td>
                <td className="py-3 px-4">
                  <Link href={`/admin/coupons/${c.id}`} className="text-sm font-medium text-blue hover:underline">
                    Edit
                  </Link>
                  <span className="mx-2 text-meta-4">|</span>
                  <AdminCouponDeleteButton couponId={c.id} couponCode={c.code} />
                </td>
              </tr>
            ))}
            {coupons.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={6}>
                  No coupons yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

