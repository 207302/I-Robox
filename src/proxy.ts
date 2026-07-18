import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseShopQueryString } from "@/lib/shop/shopQuery";
import { shopListingRedirectTarget } from "@/lib/shop/shopListingRedirect";

const SECURITY_HEADERS: [string, string][] = [
  ["X-Frame-Options", "SAMEORIGIN"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  ],
];

const IMAGE_CACHE_HEADER = "public, max-age=31536000, immutable";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * HTTP → HTTPS via Hostinger's `x-forwarded-proto`. Must precede header work
   * so we return early on the 301 (Hostinger CDN strips `next.config.js`
   * `redirects()` before they apply — proxy enforces it at the Node edge).
   *
   * Gated to production: Next.js dev (Turbopack) sends `x-forwarded-proto: http`
   * on every request, which would 301-loop `localhost:3000` to itself over HTTPS
   * and trip ERR_SSL_PROTOCOL_ERROR.
   */
  if (process.env.NODE_ENV === "production") {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const httpsUrl = request.nextUrl.clone();
      httpsUrl.protocol = "https:";
      return NextResponse.redirect(httpsUrl, { status: 301 });
    }
  }

  /**
   * Legacy /shop?brand=X / /shop?category=X → path-based landing pages, as a
   * real 308. The page-level permanentRedirect() can't produce a 3xx here:
   * shop/loading.tsx makes Next stream a 200 shell before the page component
   * runs, so its redirect degrades to a client-side one — which Google reports
   * as "page with redirect" / soft-404 instead of following it.
   */
  if (pathname === "/shop" && request.nextUrl.search) {
    const target = shopListingRedirectTarget(
      parseShopQueryString(request.nextUrl.search)
    );
    if (target) {
      const url = request.nextUrl.clone();
      const [targetPath, targetQuery = ""] = target.split("?");
      url.pathname = targetPath!;
      url.search = targetQuery;
      return NextResponse.redirect(url, { status: 308 });
    }
  }

  const response = NextResponse.next();

  /**
   * Long-cache static images in /public/images. Skips the security-header
   * block below since they don't apply to inert images and waste bytes.
   */
  if (pathname.startsWith("/images/")) {
    response.headers.set("Cache-Control", IMAGE_CACHE_HEADER);
    return response;
  }

  for (const [key, value] of SECURITY_HEADERS) {
    response.headers.set(key, value);
  }

  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /** Images explicitly opt in (the second matcher excludes their extensions). */
    "/images/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2)$).*)",
  ],
};
