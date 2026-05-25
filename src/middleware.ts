import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Hostinger CDN strips `next.config.js` `headers()` and `redirects()` before
 * they apply (Node runtime sits behind a CDN that rewrites response headers).
 * This middleware enforces them at the edge of the Node process — which
 * Hostinger forwards verbatim — so static-image cache and HTTP→HTTPS work.
 *
 * The same rules in `next.config.js` are kept as a no-op fallback.
 */

const IMAGE_CACHE_HEADER = "public, max-age=31536000, immutable";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** Long cache for static images in /public/images — must come before HTTPS redirect. */
  if (pathname.startsWith("/images/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", IMAGE_CACHE_HEADER);
    return response;
  }

  /** HTTP → HTTPS (Hostinger sets x-forwarded-proto). 301 keeps SEO. */
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, { status: 301 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/images/:path*",
    /** Everything except framework assets, API, favicon. */
    "/((?!_next/static|_next/image|api/|favicon.ico).*)",
  ],
};
