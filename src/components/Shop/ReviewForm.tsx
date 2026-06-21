"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { EmptyStarIcon, FullStarIcon } from "@/assets/icons";
import {
  validateOptionalText,
  validateReviewComment,
  validateStarRating,
} from "@/lib/validation/rules";

export default function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ratingResult = validateStarRating(rating);
    const titleResult = validateOptionalText(title, 255);
    const commentResult = validateReviewComment(comment);
    if (!ratingResult.ok) {
      toast.error(ratingResult.error);
      return;
    }
    if (!titleResult.ok) {
      toast.error(titleResult.error);
      return;
    }
    if (!commentResult.ok) {
      toast.error(commentResult.error);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          rating: ratingResult.value,
          title: titleResult.value,
          comment: commentResult.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit review");
      setTitle("");
      setComment("");
      toast.success("Review submitted for moderation");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-dark">Rating</span>
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-gray-3 bg-white px-3 py-2"
            onMouseLeave={() => setHoverRating(null)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const activeValue = hoverRating ?? rating;
              const filled = star <= activeValue;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onFocus={() => setHoverRating(star)}
                  onBlur={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  aria-pressed={rating === star}
                >
                  {filled ? <FullStarIcon /> : <EmptyStarIcon />}
                </button>
              );
            })}
            <span className="ml-1 text-xs text-meta-3">{rating}/5</span>
          </div>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-dark">Title (optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-dark">Comment</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          required
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          placeholder="Tell us what you think…"
        />
      </label>

      <button
        disabled={loading}
        className="rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit review"}
      </button>

      <p className="text-xs text-meta-4">
        Reviews require moderation and are limited to one review per purchased item.
      </p>
    </form>
  );
}

