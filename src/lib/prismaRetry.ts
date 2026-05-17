import { Prisma } from "@prisma/client";

function isTransientConnectionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1002" || error.code === "P1017";
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /Can't reach database server|Connection timed out|ECONNREFUSED|ETIMEDOUT|PostgreSQL connection|kind: Closed|Connection closed|Connection terminated/i.test(
    msg
  );
}

/** Retry Neon cold starts / brief network blips (common on free tier after idle). */
export async function withPrismaRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
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
