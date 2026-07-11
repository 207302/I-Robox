import Link from "next/link";
import Image from "next/image";
import ReviewStar from "@/components/Shop/ReviewStar";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";
import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

export default function HomeFeaturedReviewCard({ review }: { review: HomeFeaturedReview }) {
  return (
    <div className="flex gap-4">
      <Link
        href={`/shop/${review.productSlug}`}
        prefetch={shouldPrefetchHref(`/shop/${review.productSlug}`)}
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white"
        aria-label={`View ${review.productName}`}
      >
        <Image
          src={review.productImageUrl ?? PRODUCT_IMAGE_PLACEHOLDER}
          alt={review.productName}
          fill
          sizes="96px"
          className="object-contain p-1"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
          <ReviewStar avgRating={review.rating} />
        </div>
        <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
        <p className="mt-3 text-sm italic text-gray-500">{review.reviewerLabel}</p>
      </div>
    </div>
  );
}
