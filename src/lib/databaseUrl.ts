const BUILD_PHASE = "phase-production-build";

export function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === BUILD_PHASE;
}

export type NormalizeUrlOptions = {
  /** Pooled app URL (Neon `-pooler` host): adds `pgbouncer=true`. */
  pooled?: boolean;
};

/**
 * Neon + Prisma URL normalization.
 * - Pooled: `pgbouncer=true`, `sslmode=require`, tuned pool timeouts.
 * - Direct: no pgbouncer (migrations / advisory locks).
 */
export function normalizeDatabaseUrl(raw: string, opts?: NormalizeUrlOptions): string {
  const building = isProductionBuildPhase();
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    u.searchParams.set("connect_timeout", building ? "30" : "10");

    if (opts?.pooled) {
      u.searchParams.set("connection_limit", connectionLimitForRuntime());
      u.searchParams.set("pool_timeout", building ? "60" : "20");
      if (u.hostname.includes("-pooler.")) {
        u.searchParams.set("pgbouncer", "true");
      } else {
        u.searchParams.delete("pgbouncer");
      }
    } else {
      u.searchParams.delete("pgbouncer");
      u.searchParams.set("connection_limit", "1");
      u.searchParams.set("pool_timeout", "30");
    }

    return u.toString();
  } catch {
    return raw;
  }
}

/** Pooled app runtime. Build: low limit per worker. Prod: 1/process. Dev: 10. */
export function connectionLimitForRuntime(): string {
  if (isProductionBuildPhase()) {
    const build = process.env.BUILD_DATABASE_CONNECTION_LIMIT?.trim();
    if (build && /^\d+$/.test(build)) return build;
    return "2";
  }
  if (process.env.NODE_ENV !== "production") return "10";
  const fromEnv = process.env.DATABASE_CONNECTION_LIMIT?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) return fromEnv;
  return "1";
}

export function deriveDirectUrlFromPooled(pooledUrl: string): string {
  const direct = pooledUrl.includes("-pooler.")
    ? pooledUrl.replace("-pooler.", ".")
    : pooledUrl;
  return normalizeDatabaseUrl(direct, { pooled: false });
}
