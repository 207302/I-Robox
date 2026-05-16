import { NextResponse } from "next/server";

const API_TIMEOUT_MS = 10_000;

export type RunApiRouteOptions = {
  /** Override default 10s cap (e.g. shop listing with typo-tolerant search). */
  timeoutMs?: number;
};

export async function runApiRoute(
  handler: () => Promise<NextResponse | Response>,
  options?: RunApiRouteOptions
): Promise<NextResponse> {
  const timeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS;
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
      console.error("[API TIMEOUT]");
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
    console.error("[API ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
