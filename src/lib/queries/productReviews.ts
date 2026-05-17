import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PRODUCT_PAGE_REVALIDATE_SECONDS } from "@/lib/cache/constants";
import { productReviewsTag } from "@/lib/cache/tags";

export type ApprovedProductReview = {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  created_at: Date;
  is_verified_purchase: boolean;
};

async function loadApprovedReviews(productId: string): Promise<ApprovedProductReview[]> {
  return prisma.reviews.findMany({
    where: { product_id: productId, is_approved: true },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      created_at: true,
      is_verified_purchase: true,
    },
    take: 10,
  });
}

/** Public approved reviews for PDP — ISR-safe (no session). */
export function getApprovedReviewsForProduct(
  productId: string
): Promise<ApprovedProductReview[]> {
  const id = productId.trim();
  if (!id) return Promise.resolve([]);

  return unstable_cache(() => loadApprovedReviews(id), ["product-approved-reviews", id], {
    revalidate: PRODUCT_PAGE_REVALIDATE_SECONDS,
    tags: [productReviewsTag(id)],
  })();
}
