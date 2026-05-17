/** Full structured perf logs (all routes). */
export function isPerfLogEnabled(): boolean {
  return process.env.PERF_LOG === "1";
}

/** Sample rate 0–1 when PERF_LOG is off (production default 0.05). */
export function perfSampleRate(): number {
  if (isPerfLogEnabled()) return 1;
  const raw = process.env.PERF_SAMPLE_RATE?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return process.env.NODE_ENV === "production" ? 0.05 : 1;
}

export function perfSlowRouteMs(): number {
  return readIntEnv("PERF_SLOW_ROUTE_MS", 1500);
}

export function perfSlowPrismaMs(): number {
  return readIntEnv("PERF_SLOW_PRISMA_MS", 250);
}

export function perfSlowApiMs(): number {
  return readIntEnv("PERF_SLOW_API_MS", 2000);
}

export function perfHighPrismaQueryCount(): number {
  return readIntEnv("PERF_HIGH_PRISMA_COUNT", 12);
}

function readIntEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}
