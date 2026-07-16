export const DEFAULT_REVIEW_REQUEST_DELAY_HOURS = 24;
export const MIN_REVIEW_REQUEST_DELAY_HOURS = 0;
export const MAX_REVIEW_REQUEST_DELAY_HOURS = 720; // 30 days

export function resolveReviewRequestDelayHours(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_REVIEW_REQUEST_DELAY_HOURS;
  }
  return Math.min(
    MAX_REVIEW_REQUEST_DELAY_HOURS,
    Math.max(MIN_REVIEW_REQUEST_DELAY_HOURS, Math.round(value))
  );
}
