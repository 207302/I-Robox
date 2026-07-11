import ReviewStar from "@/components/Shop/ReviewStar";
import type { ApprovedProductReview } from "@/lib/queries/productReviews";

function formatReviewDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default function ProductReviewCard({ review }: { review: ApprovedProductReview }) {
  return (
    <article className="h-full rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-dark">
            {review.is_verified_purchase ? "Verified buyer" : "Customer"}
          </span>
          <ReviewStar avgRating={review.rating} />
        </div>
        <time className="text-xs text-gray-500" dateTime={new Date(review.created_at).toISOString()}>
          {formatReviewDate(review.created_at)}
        </time>
      </div>
      {review.title ? (
        <h4 className="mt-2 text-sm font-semibold text-dark">{review.title}</h4>
      ) : null}
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{review.comment}</p>
    </article>
  );
}
