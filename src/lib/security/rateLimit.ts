import { RateLimiterMemory } from "rate-limiter-flexible";

const limiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

/** Storefront/session APIs (Lighthouse + cart sync) — avoid 429 during bursty navigation. */
const storefrontLimiter = new RateLimiterMemory({
  points: 120,
  duration: 60,
});

const strictLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

export async function rateLimit(key: string, points = 1) {
  await limiter.consume(key, points);
}

export async function rateLimitStorefront(key: string, points = 1) {
  await storefrontLimiter.consume(key, points);
}

export async function rateLimitStrict(key: string, points = 1) {
  await strictLimiter.consume(key, points);
}

