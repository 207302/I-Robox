import ReviewsAdminPanel from "@/components/admin/ReviewsAdminPanel";
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
      rating: true,
      title: true,
      comment: true,
      is_approved: true,
      is_verified_purchase: true,
      created_at: true,
      products: { select: { name: true, slug: true } },
      customers: { select: { email: true } },
    },
  });

  const rows = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    is_approved: r.is_approved,
    is_verified_purchase: r.is_verified_purchase,
    created_at: r.created_at.toISOString(),
    productName: r.products?.name ?? "Unknown product",
    productSlug: r.products?.slug ?? "",
    customerEmail: r.customers?.email ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Reviews</h1>
      <ReviewsAdminPanel reviews={rows} />
    </div>
  );
}
