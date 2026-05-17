import { Prisma } from "@prisma/client";
import { isProductionBuildPhase, prismaReady, reinitializePrismaClient } from "@/lib/prisma";

const DB_TIMEOUT_MS = isProductionBuildPhase() ? 3_000 : 8_000;
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

/**
 * Runs a Prisma call with an 8s timeout, one retry on engine panic (reinit client),
 * one retry after 2s on unreachable DB, and graceful fallback on timeout.
 */
export async function withDb<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  const execute = async (): Promise<T> => {
    await prismaReady();
    return runWithTimeout(fn, DB_TIMEOUT_MS);
  };

  try {
    return await execute();
  } catch (error) {
    if (isDbTimeout(error)) {
      console.error("[withDb] timed out after", DB_TIMEOUT_MS, "ms");
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
