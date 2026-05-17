import { AsyncLocalStorage } from "async_hooks";
import {
  isPerfLogEnabled,
  perfHighPrismaQueryCount,
  perfSlowRouteMs,
} from "@/lib/observability/config";
import { perfLog } from "@/lib/observability/logger";

export type PerfSpan = {
  label: string;
  ms: number;
};

export type PerfContext = {
  route: string;
  kind: "route" | "api" | "page";
  startedAt: number;
  prismaQueries: number;
  prismaMs: number;
  queryCounts: Map<string, number>;
  slowQueries: { model: string; operation: string; ms: number }[];
  cacheMisses: string[];
  spans: PerfSpan[];
};

const perfStorage = new AsyncLocalStorage<PerfContext>();

export function getPerfContext(): PerfContext | undefined {
  return perfStorage.getStore();
}

export function runWithPerfContext<T>(
  route: string,
  kind: PerfContext["kind"],
  fn: () => Promise<T>
): Promise<T> {
  const ctx: PerfContext = {
    route,
    kind,
    startedAt: Date.now(),
    prismaQueries: 0,
    prismaMs: 0,
    queryCounts: new Map(),
    slowQueries: [],
    cacheMisses: [],
    spans: [],
  };
  return perfStorage.run(ctx, async () => {
    try {
      return await fn();
    } finally {
      finishPerfContext();
    }
  });
}

export function recordPrismaQuery(model: string, operation: string, ms: number): void {
  const ctx = getPerfContext();
  if (!ctx) return;

  ctx.prismaQueries += 1;
  ctx.prismaMs += ms;

  const key = `${model}.${operation}`;
  ctx.queryCounts.set(key, (ctx.queryCounts.get(key) ?? 0) + 1);
}

export function recordSlowPrismaQuery(model: string, operation: string, ms: number): void {
  const ctx = getPerfContext();
  if (!ctx) return;
  ctx.slowQueries.push({ model, operation, ms });
  if (ctx.slowQueries.length > 20) ctx.slowQueries.shift();
}

export function recordCacheMiss(name: string): void {
  const ctx = getPerfContext();
  if (!ctx) return;
  if (!ctx.cacheMisses.includes(name)) ctx.cacheMisses.push(name);
}

export async function profiledSpan<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const ctx = getPerfContext();
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    const ms = Date.now() - t0;
    if (ctx) {
      ctx.spans.push({ label, ms });
      if (ctx.spans.length > 32) ctx.spans.shift();
    }
  }
}

function repeatedQueries(ctx: PerfContext): { key: string; count: number }[] {
  return [...ctx.queryCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function shouldLogRouteSummary(ctx: PerfContext, elapsedMs: number): boolean {
  if (isPerfLogEnabled()) return true;
  if (elapsedMs >= perfSlowRouteMs()) return true;
  if (ctx.prismaQueries >= perfHighPrismaQueryCount()) return true;
  if (ctx.slowQueries.length > 0) return true;
  if (ctx.cacheMisses.length > 0 && elapsedMs >= 800) return true;
  return false;
}

export function finishPerfContext(extra?: Record<string, unknown>): void {
  const ctx = getPerfContext();
  if (!ctx) return;

  const elapsedMs = Date.now() - ctx.startedAt;
  if (!shouldLogRouteSummary(ctx, elapsedMs)) return;

  const topSlowest = [...ctx.spans].sort((a, b) => b.ms - a.ms).slice(0, 6);
  const repeated = repeatedQueries(ctx);

  perfLog(
    ctx.kind === "api" ? "api" : "route",
    {
      route: ctx.route,
      elapsedMs,
      prismaQueries: ctx.prismaQueries,
      prismaMs: ctx.prismaMs,
      cacheMisses: ctx.cacheMisses,
      slowPrisma: ctx.slowQueries.slice(0, 5),
      topSlowest,
      repeatedQueries: repeated,
      ...extra,
    },
    true
  );
}
