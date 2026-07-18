"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ReviewStar from "@/components/Shop/ReviewStar";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";
import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

export default function HomeFeaturedReviewCard({ review }: { review: HomeFeaturedReview }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const commentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [review.comment, expanded]);

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
        <p
          ref={commentRef}
          className={`mt-2 text-sm text-gray-700 ${expanded ? "" : "line-clamp-5 md:line-clamp-none"}`}
        >
          {review.comment}
        </p>
        {clamped || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-semibold text-blue hover:underline md:hidden"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}
        <p className="mt-3 text-sm italic text-gray-500">{review.reviewerLabel}</p>
      </div>
    </div>
  );
}
