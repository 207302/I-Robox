import { Prisma } from "@prisma/client";
import { isProductionBuildPhase, prismaReady, reinitializePrismaClient } from "@/lib/prisma";

/** Build SSG can hit cold Neon (30–45s). Runtime prod allows serverless wake-up. */
function dbTimeoutMs(): number {
  if (isProductionBuildPhase()) return 60_000;
  if (process.env.NODE_ENV !== "production") return 30_000;
  return 12_000;
}

const UNREACHABLE_RETRY_MS = 2_000;

class DbTimeoutError extends Error {
  constructor() {
    super("DB_TIMEOUT");
    this.name = "DbTimeoutError";
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isDbTimeout(error: unknown): boolean {
  return error instanceof DbTimeoutError || (error instanceof Error && error.message === "DB_TIMEOUT");
}

function isRustPanic(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /PrismaClientRustPanicError|RustPanic|timer has gone away|library already starting/i.test(msg);
}

function isUnreachableDatabase(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001" || error.code === "P1002") return true;
    return error.message.includes("Can't reach database");
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /Can't reach database server/i.test(msg);
}

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new DbTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function shouldUseTimeout(): boolean {
  return process.env.NODE_ENV === "production" && !isProductionBuildPhase();
}

/**
 * Runs a Prisma call with timeout (prod runtime only), retry on panic/unreachable, fallback on timeout.
 * Build + dev: no timeout — SSG and local parallel queries must finish.
 */
export async function withDb<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  const timeoutMs = dbTimeoutMs();

  const execute = async (): Promise<T> => {
    await prismaReady();
    if (!shouldUseTimeout()) {
      return fn();
    }
    return runWithTimeout(fn, timeoutMs);
  };

  try {
    return await execute();
  } catch (error) {
    if (isDbTimeout(error)) {
      console.error("[withDb] timed out after", timeoutMs, "ms");
      return fallback;
    }

    if (isRustPanic(error)) {
      console.error("[withDb] Prisma engine panic, reinitializing client:", error);
      try {
        await reinitializePrismaClient();
        return await execute();
      } catch (retryError) {
        if (isDbTimeout(retryError)) return fallback;
        console.error("[withDb] retry after panic failed:", retryError);
        return fallback;
      }
    }

    if (isUnreachableDatabase(error)) {
      console.error("[withDb] database unreachable, retrying once:", error);
      await sleep(UNREACHABLE_RETRY_MS);
      try {
        return await execute();
      } catch (retryError) {
        if (isDbTimeout(retryError)) return fallback;
        console.error("[withDb] retry after unreachable failed:", retryError);
        return fallback;
      }
    }

    console.error("[withDb] unhandled error:", error);
    return fallback;
  }
}
