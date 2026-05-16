import { NextResponse } from "next/server";

const API_TIMEOUT_MS = 10_000;

export async function runApiRoute(
  handler: () => Promise<NextResponse | Response>
): Promise<NextResponse> {
  try {
    const result = await Promise.race([
      handler(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("API_TIMEOUT")), API_TIMEOUT_MS);
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
