import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Admin Reviews | i-Robox",
};

export default async function AdminReviewsPage() {
  const reviews = await prisma.reviews.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      product_id: true,
      rating: true,
      title: true,
      comment: true,
      is_approved: true,
      is_verified_purchase: true,
      created_at: true,
      products: { select: { name: true } },
      customers: { select: { email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Reviews</h1>

      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Approved</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-gray-3">
                <td className="py-3 px-4">
                  <div className="font-semibold text-dark">{r.products?.name ?? "—"}</div>
                  <div className="text-xs text-meta-4 line-clamp-1">
                    {r.title ? `${r.title} — ` : ""}
                    {r.comment}
                  </div>
                </td>
                <td className="py-3 px-4 text-dark">
                  {r.rating}/5{" "}
                  {r.is_verified_purchase ? (
                    <span className="ml-2 text-xs rounded-full bg-gray-1 border border-gray-3 px-2 py-1 text-dark">
                      Verified
                    </span>
                  ) : null}
                </td>
                <td className="py-3 px-4 text-dark">{r.customers?.email ?? "—"}</td>
                <td className="py-3 px-4 text-dark">{r.is_approved ? "Yes" : "No"}</td>
                <td className="py-3 px-4">
                  {r.is_approved ? (
                    <form action={`/api/admin/reviews/${r.id}/delete`} method="post" className="inline">
                      <button className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                    </form>
                  ) : (
                    <>
                      <form action={`/api/admin/reviews/${r.id}/approve`} method="post" className="inline">
                        <button className="text-sm font-medium text-blue hover:underline">
                          Approve
                        </button>
                      </form>
                      <span className="mx-2 text-meta-4">|</span>
                      <form action={`/api/admin/reviews/${r.id}/reject`} method="post" className="inline">
                        <button className="text-sm font-medium text-meta-3 hover:text-dark">
                          Reject
                        </button>
                      </form>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {reviews.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={5}>
                  No reviews yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

