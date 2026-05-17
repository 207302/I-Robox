"use client";

import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import ReviewForm from "@/components/Shop/ReviewForm";

type Props = {
  productId: string;
};

/** Session-gated review form — keeps PDP server render free of `cookies()`. */
export default function ProductReviewComposer({ productId }: Props) {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <p className="mt-6 text-sm text-meta-3" aria-live="polite">
        Checking sign-in…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="mt-6 text-sm text-meta-3">
        Please <Link className="text-blue hover:underline" href="/login">sign in</Link> to
        write a review.
      </p>
    );
  }

  return (
    <>
      <h3 className="mt-8 text-base font-semibold text-dark">Write a review</h3>
      <ReviewForm productId={productId} />
    </>
  );
}
