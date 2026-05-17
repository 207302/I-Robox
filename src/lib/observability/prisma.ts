import "server-only";

import type { PrismaClient } from "@prisma/client";
import { perfSlowPrismaMs } from "@/lib/observability/config";
import { recordPrismaQuery, recordSlowPrismaQuery } from "@/lib/observability/context";
import { perfLog } from "@/lib/observability/logger";

/** Attach query timing + counts (no-op overhead when ALS has no perf context, except slow-query logs). */
export function extendPrismaForPerf(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, query, args }) {
          const start = Date.now();
          const result = await query(args);
          const ms = Date.now() - start;

          recordPrismaQuery(model, operation, ms);

          if (ms >= perfSlowPrismaMs()) {
            recordSlowPrismaQuery(model, operation, ms);
            perfLog(
              "prisma_slow",
              { model, operation, ms },
              false
            );
          }

          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}
