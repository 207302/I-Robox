import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

export const HOME_FEATURED_REVIEW_COUNT = 10;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueById(reviews: HomeFeaturedReview[]): HomeFeaturedReview[] {
  const seen = new Set<string>();
  const out: HomeFeaturedReview[] = [];
  for (const review of reviews) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    out.push(review);
  }
  return out;
}

/**
 * Pick a fresh random subset of reviews on every call (page load / refresh).
 * Selection is client-side so each device and each reload gets a different set.
 */
export function pickHomeReviewsForSession(pool: HomeFeaturedReview[]): HomeFeaturedReview[] {
  const unique = uniqueById(pool);
  if (unique.length <= 1) return unique;

  return shuffle(unique).slice(0, HOME_FEATURED_REVIEW_COUNT);
}
