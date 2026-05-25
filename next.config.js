/**
 * Env: `next dev` loads `.env.local` automatically; `npm run build` loads via
 * `scripts/run-prisma-build.mjs`. Do not use fs/path here — Turbopack NFT traces the repo.
 */

// TODO: Legacy polyfills (18KB) in 0p.tczh1i.rg1.js persist due to Turbopack not
// honouring browserslist in Next.js 16. Re-check when Next.js 17 or Turbopack stable ships.

const nextConfig = {
  /** SSG pages (PDPs, ISR shells) — Neon cold queries can exceed 60s default. */
  staticPageGenerationTimeout: Number(process.env.STATIC_PAGE_GENERATION_TIMEOUT ?? 180),
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: {
    // browsersListForSwc was removed in Next.js 16; legacy polyfill drop now depends on Turbopack honouring browserslist (see TODO at top of file).
    workerThreads: false,
    /** Fewer SSG workers = less Neon connection churn during `next build`. Override with STATIC_GENERATION_CPUS=2 */
    cpus: Number(process.env.STATIC_GENERATION_CPUS ?? 1),
    optimizeCss: true,
    optimizePackageImports: [
      "lucide-react",
      "@heroicons/react",
      "date-fns",
      "lodash",
      "dayjs",
      "react-hot-toast",
      "swiper",
      "@radix-ui/react-slider",
    ],
  },
  async headers() {
    return [
      {
        source: "/images/payment/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/shop",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
  redirects: async () => {
    return [
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://i-robox.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.i-robox.com" }],
        destination: "https://i-robox.com/:path*",
        permanent: true,
      },
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: true,
      },
    ];
  },
};

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config) => config;

/** @type {import('next').NextConfig} */
module.exports = withBundleAnalyzer(nextConfig);
