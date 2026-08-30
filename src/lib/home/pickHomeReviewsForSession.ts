import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

export const HOME_FEATURED_REVIEW_COUNT = 10;
const STORAGE_KEY = "irobox.homeFeaturedReviewIds";

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

function readStoredIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode / quota */
  }
}

/** Unique random reviews for this browser session; a new session gets a new set. */
export function pickHomeReviewsForSession(
  pool: HomeFeaturedReview[],
  count = HOME_FEATURED_REVIEW_COUNT
): HomeFeaturedReview[] {
  const unique = uniqueById(pool);
  if (unique.length <= 1) return unique;

  const limit = Math.min(count, unique.length);
  const byId = new Map(unique.map((review) => [review.id, review]));
  const restored = readStoredIds()
    .map((id) => byId.get(id))
    .filter((review): review is HomeFeaturedReview => Boolean(review));

  if (restored.length >= limit) {
    return uniqueById(restored).slice(0, limit);
  }

  const have = new Set(restored.map((review) => review.id));
  const fillers = shuffle(unique.filter((review) => !have.has(review.id)));
  const picked = uniqueById([...restored, ...fillers]).slice(0, limit);
  writeStoredIds(picked.map((review) => review.id));
  return picked;
}
