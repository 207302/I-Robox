import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

const STORAGE_KEY = "irobox.homeFeaturedReviewOrder.v2";

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

/**
 * Full unique shuffle for this browser session.
 * Every eligible review is included; a new session gets a new order.
 */
export function pickHomeReviewsForSession(pool: HomeFeaturedReview[]): HomeFeaturedReview[] {
  const unique = uniqueById(pool);
  if (unique.length <= 1) return unique;

  const byId = new Map(unique.map((review) => [review.id, review]));
  const uniqueIds = new Set(unique.map((review) => review.id));
  const stored = readStoredIds();
  const storedIsFullShuffle =
    stored.length === unique.length &&
    stored.every((id) => uniqueIds.has(id)) &&
    new Set(stored).size === unique.length;

  if (storedIsFullShuffle) {
    return stored.map((id) => byId.get(id)!);
  }

  const shuffled = shuffle(unique);
  writeStoredIds(shuffled.map((review) => review.id));
  return shuffled;
}
