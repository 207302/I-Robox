export const DEFAULT_HERO_CAROUSEL_INTERVAL_MS = 7000;
export const MIN_HERO_CAROUSEL_INTERVAL_MS = 2000;
export const MAX_HERO_CAROUSEL_INTERVAL_MS = 60_000;

export function resolveHeroCarouselIntervalMs(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_HERO_CAROUSEL_INTERVAL_MS;
  }
  return Math.min(
    MAX_HERO_CAROUSEL_INTERVAL_MS,
    Math.max(MIN_HERO_CAROUSEL_INTERVAL_MS, Math.round(value))
  );
}

export function heroCarouselIntervalMsFromSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_HERO_CAROUSEL_INTERVAL_MS;
  return resolveHeroCarouselIntervalMs(seconds * 1000);
}

export function heroCarouselIntervalSecondsFromMs(ms: number | null | undefined): number {
  return resolveHeroCarouselIntervalMs(ms) / 1000;
}
