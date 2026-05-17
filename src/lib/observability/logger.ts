import { isPerfLogEnabled, perfSampleRate } from "@/lib/observability/config";

export type PerfLogEvent =
  | "route"
  | "api"
  | "prisma_slow"
  | "prisma_summary"
  | "cache_miss"
  | "cache_summary";

export type PerfLogPayload = Record<string, unknown>;

let sampleCounter = 0;

function shouldEmit(): boolean {
  if (isPerfLogEnabled()) return true;
  const rate = perfSampleRate();
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  sampleCounter = (sampleCounter + 1) % 100;
  return sampleCounter < rate * 100;
}

/** Single-line JSON for log aggregators (Hostinger → file → future Loki/Datadog). */
export function perfLog(event: PerfLogEvent, payload: PerfLogPayload, force = false): void {
  if (!force && !shouldEmit()) return;
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      channel: "perf",
      event,
      ...payload,
    });
    console.info(line);
  } catch {
    /* never throw from logging */
  }
}
