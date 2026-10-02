import { Prisma } from "@prisma/client";
import { prismaReady } from "@/lib/prisma";

function isTransientConnectionError(error: unknown) {
  if (isPrismaPoolSaturationError(error)) return false;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1002" || error.code === "P1017";
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /Can't reach database server|Connection timed out|ECONNREFUSED|ETIMEDOUT|PostgreSQL connection|kind: Closed|Connection closed|Connection terminated|timer has gone away|library already starting|PrismaClientRustPanicError/i.test(
      msg
    )
  );
}

/** Pool wait, interactive-transaction start/expiry, or a write conflict. Safe to retry. */
export function isPrismaPoolSaturationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2024" || error.code === "P2028" || error.code === "P2034") return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /Unable to start a transaction|Transaction already closed|Transaction not found|Timed out fetching a new connection from the connection pool/i.test(
    msg
  );
}

/** Retry Neon cold starts / brief network blips (common on free tier after idle). */
export async function withPrismaRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await prismaReady();
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientConnectionError(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}
