# Performance monitoring

Structured perf logs help find slow routes, query explosions, and cache misses on Hostinger + Neon.

## Enable

| Variable | Default | Effect |
|----------|---------|--------|
| `PERF_LOG=1` | off | Log **every** instrumented route/API summary |
| `PERF_SAMPLE_RATE` | `0.05` prod | Fraction of requests logged when `PERF_LOG` is off |
| `PERF_SLOW_ROUTE_MS` | `1500` | Always log route/API slower than this |
| `PERF_SLOW_PRISMA_MS` | `250` | Log individual slow Prisma ops |
| `PERF_SLOW_API_MS` | `2000` | Documented alias threshold for APIs (via route ms) |
| `PERF_HIGH_PRISMA_COUNT` | `12` | Log when a request runs this many queries |

Also existing: `SHOP_LISTING_PROFILE=1` — detailed shop listing step timings (dev/debug).

## Log format

Single JSON line per event, `channel: "perf"`:

```json
{"ts":"...","level":"info","channel":"perf","event":"route","route":"page:/shop","elapsedMs":2840,"prismaQueries":11,"prismaMs":2100,"cacheMisses":["shop-listing-facets"],"slowPrisma":[{"model":"products","operation":"groupBy","ms":420}],"topSlowest":[{"label":"listing.page","ms":890}],"repeatedQueries":[{"key":"products.findMany","count":3}]}
```

## What is instrumented

| Layer | Mechanism |
|-------|-----------|
| **Prisma** | `$extends` on client — per-query ms, slow query logs, request totals |
| **API routes** | `runApiRoute` + optional `name: "GET /api/products"` |
| **Pages** | `withPagePerf("page:/shop", ...)` on heavy SSR pages |
| **unstable_cache** | `onCacheMiss("home-page-bundle", loader)` inside cache fn |
| **Shop listing** | `SHOP_LISTING_PROFILE` + shared `profiledSpan` when perf context active |

## Finding bottlenecks

### Highest-cost routes

```bash
# Hostinger / PM2 logs
grep '"channel":"perf"' logs | jq -r '[.route, .elapsedMs] | @tsv' | sort -t$'\t' -k2 -nr | head -20
```

Look for: `page:/shop`, `page:/`, `GET /api/products`, checkout APIs.

### Slowest queries

```bash
grep '"event":"prisma_slow"' logs | jq -r '[.model, .operation, .ms] | @tsv' | sort -t$'\t' -k3 -nr | head -20
```

### Repeated operations (N+1 / duplicate work)

In route summary JSON, field `repeatedQueries` — e.g. `products.findMany` × 5 in one request.

### Cache effectiveness

`cacheMisses: []` on a warm ISR hit = good.  
`cacheMisses: ["home-page-bundle","shop-listing-facets"]` on every request = cache not hitting — check tags/TTL.

## Production strategy

1. **Normal prod:** `PERF_SAMPLE_RATE=0.05` — ~5% of requests, plus all slow/high-query requests.
2. **Incident:** `PERF_LOG=1` for 10–15 minutes, reproduce, disable.
3. **Deploy regression:** compare p95 `elapsedMs` and `prismaQueries` for `GET /api/products` before/after.
4. **Neon dashboard:** correlate `prisma_slow` spikes with connection/CPU charts.
5. **Alerts (manual):** sustained `prismaQueries` > 15 on `page:/shop` or `elapsedMs` > 5000.

## Overhead

- Prisma extension: one `Date.now()` pair per query (negligible vs DB RTT).
- ALS: only active inside `runApiRoute` / `withPagePerf`.
- Logging: skipped unless slow, sampled, or `PERF_LOG=1`.
