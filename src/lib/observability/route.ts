import { runWithPerfContext } from "@/lib/observability/context";

/** Wrap a server page / layout data load for route-level timing. */
export function withPagePerf<T>(routeName: string, fn: () => Promise<T>): Promise<T> {
  return runWithPerfContext(routeName, "page", fn);
}
