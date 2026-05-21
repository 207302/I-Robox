import { NextResponse } from "next/server";
import { runWithPerfContext } from "@/lib/observability/context";
import { perfSlowApiMs } from "@/lib/observability/config";

const API_TIMEOUT_MS = 10_000;

export type RunApiRouteOptions = {
  /** Override default 10s cap (e.g. shop listing with typo-tolerant search). */
  timeoutMs?: number;
  /** Route label for perf logs, e.g. `GET /api/products`. */
  name?: string;
};

export async function runApiRoute(
  handler: () => Promise<NextResponse | Response>,
  options?: RunApiRouteOptions
): Promise<NextResponse> {
  const timeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS;
  const routeName = options?.name ?? "api:unknown";

  return runWithPerfContext(routeName, "api", async () => {
    try {
      const result = await Promise.race([
        handler(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("API_TIMEOUT")), timeoutMs);
        }),
      ]);
      return result instanceof NextResponse ? result : NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "API_TIMEOUT") {
        console.error(
          JSON.stringify({
            channel: "perf",
            event: "api_timeout",
            route: routeName,
            timeoutMs,
            slowApiThresholdMs: perfSlowApiMs(),
          })
        );
        return NextResponse.json(
          {
            error:
              "Request timed out. The server or database took too long to respond — wait a few seconds and try again.",
            code: "TIMEOUT",
          },
          { status: 503 }
        );
      }
      console.error("[API ERROR]", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
