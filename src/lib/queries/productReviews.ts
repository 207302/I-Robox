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

async function loadFeaturedHomeReview(): Promise<HomeFeaturedReview | null> {
  const rows = await prisma.reviews.findMany({
    where: {
      is_approved: true,
      comment: { not: null },
      products: { is_active: true },
    },
    orderBy: { created_at: "desc" },
    take: 10,
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

  const row = rows.find((candidate) => candidate.comment?.trim());
  const comment = row?.comment?.trim();
  if (!row || !comment) return null;

  return {
    id: row.id,
    rating: row.rating,
    comment,
    reviewerLabel: formatReviewerLabel(row.customers?.name, row.is_verified_purchase),
    productSlug: row.products.slug,
    productName: row.products.name,
    productImageUrl: row.products.product_images[0]?.url ?? null,
  };
}

/** Latest approved review for homepage testimonial — ISR-safe (no session). */
export function getFeaturedHomeReview(): Promise<HomeFeaturedReview | null> {
  return unstable_cache(loadFeaturedHomeReview, ["home-featured-review"], {
    revalidate: HOME_PAGE_REVALIDATE_SECONDS,
    tags: [HOME_PAGE_TAG],
  })();
}
