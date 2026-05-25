import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
   */
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, { status: 301 });
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
