import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PRODUCT_PAGE_REVALIDATE_SECONDS } from "@/lib/cache/constants";
import { HOME_PAGE_REVALIDATE_SECONDS } from "@/lib/cache/homePageCache";
import { HOME_PAGE_TAG, productReviewsTag } from "@/lib/cache/tags";

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

export type HomeFeaturedReview = {
  id: string;
  rating: number;
  comment: string;
  reviewerLabel: string;
  productSlug: string;
  productName: string;
  productImageUrl: string | null;
};

function formatReviewerLabel(
  customerName: string | null | undefined,
  isVerifiedPurchase: boolean
): string {
  const name = customerName?.trim();
  if (name) {
    const firstName = name.split(/\s+/)[0];
    return `— ${firstName}`;
  }
  if (isVerifiedPurchase) return "— Verified buyer";
  return "— Customer";
}

const HOME_FEATURED_REVIEW_POOL_SIZE = 100;

async function loadFeaturedHomeReviews(): Promise<HomeFeaturedReview[]> {
  const sampled = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id
    FROM reviews r
    INNER JOIN products p ON p.id = r.product_id
    WHERE r.is_approved = true
      AND r.comment IS NOT NULL
      AND length(btrim(r.comment)) > 0
      AND p.is_active = true
    ORDER BY RANDOM()
    LIMIT ${HOME_FEATURED_REVIEW_POOL_SIZE}
  `;
  if (sampled.length === 0) return [];

  const rows = await prisma.reviews.findMany({
    where: { id: { in: sampled.map((row) => row.id) } },
    select: {
      id: true,
      rating: true,
      comment: true,
      is_verified_purchase: true,
      customers: { select: { name: true } },
      products: {
        select: {
          slug: true,
          name: true,
          product_images: {
            orderBy: { sort_order: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  return rows
    .map((row) => {
      const comment = row.comment?.trim();
      if (!comment) return null;

      return {
        id: row.id,
        rating: row.rating,
        comment,
        reviewerLabel: formatReviewerLabel(row.customers?.name, row.is_verified_purchase),
        productSlug: row.products.slug,
        productName: row.products.name,
        productImageUrl: row.products.product_images[0]?.url ?? null,
      };
    })
    .filter((review): review is HomeFeaturedReview => review !== null);
}

/** Approved review pool for homepage testimonials — client picks a random session set. */
export function getFeaturedHomeReviews(): Promise<HomeFeaturedReview[]> {
  return unstable_cache(loadFeaturedHomeReviews, ["home-featured-reviews-pool"], {
    revalidate: HOME_PAGE_REVALIDATE_SECONDS,
    tags: [HOME_PAGE_TAG],
  })();
}
