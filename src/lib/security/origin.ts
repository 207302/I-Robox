import type { NextRequest } from "next/server";

function addOriginVariants(origins: Set<string>, rawUrl: string) {
  try {
    const base = new URL(rawUrl);
    origins.add(base.origin);

    const host = base.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      const noWww = new URL(base.origin);
      noWww.hostname = host.slice(4);
      origins.add(noWww.origin);
      return;
    }

    if (host.includes(".")) {
      const withWww = new URL(base.origin);
      withWww.hostname = `www.${host}`;
      origins.add(withWww.origin);
    }
  } catch {
    // ignore invalid URLs
  }
}

function getAllowedOrigins() {
  const origins = new Set<string>();
  const fromEnv = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
  ].filter(Boolean) as string[];
  for (const v of fromEnv) {
    addOriginVariants(origins, v);
  }
  return origins;
}

/**
 * Lightweight CSRF hardening for cookie-auth endpoints.
 * We require requests with an Origin header to match one of our configured site origins.
 * (SameSite cookies already help, this adds a stricter check for browsers.)
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients, or same-origin navigation without Origin
  const allowed = getAllowedOrigins();
  if (allowed.size === 0) return; // if not configured, don't block
  if (!allowed.has(origin)) {
    throw new Error("BAD_ORIGIN");
  }
}

