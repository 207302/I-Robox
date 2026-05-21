import { prismaReady } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";
import { runApiRoute, type RunApiRouteOptions } from "@/lib/api/runApiRoute";
import type { NextResponse } from "next/server";

const ADMIN_API_TIMEOUT_MS = 45_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Admin routes: warm Neon/Prisma, retry transient DB blips, longer timeout, one retry on route timeout.
 */
export async function runAdminApiRoute(
  handler: () => Promise<NextResponse | Response>,
  options?: Omit<RunApiRouteOptions, "timeoutMs"> & { timeoutMs?: number }
): Promise<NextResponse> {
  const timeoutMs = options?.timeoutMs ?? ADMIN_API_TIMEOUT_MS;
  const routeName = options?.name ?? "admin:unknown";

  const runOnce = async () => {
    await prismaReady();
    return withPrismaRetry(handler, 3);
  };

  const first = await runApiRoute(runOnce, {
    ...options,
    timeoutMs,
    name: routeName,
  });

  if (first.status !== 503) return first;

  let body: { code?: string } = {};
  try {
    body = await first.clone().json();
  } catch {
    return first;
  }

  if (body.code !== "TIMEOUT") return first;

  console.warn(
    JSON.stringify({
      channel: "perf",
      event: "admin_api_timeout_retry",
      route: routeName,
    })
  );

  await prismaReady();
  await sleep(1500);

  return runApiRoute(runOnce, {
    ...options,
    timeoutMs,
    name: `${routeName}:retry`,
  });
}
