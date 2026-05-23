/**
 * Env: `next dev` loads `.env.local` automatically; `npm run build` loads via
 * `scripts/run-prisma-build.mjs`. Do not use fs/path here — Turbopack NFT traces the repo.
 */

/** @type {import('next').NextConfig} */
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
        source: "/images/icons/:path*",
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
            value: "public, max-age=86400, stale-while-revalidate=604800",
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
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
