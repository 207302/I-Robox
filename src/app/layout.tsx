import "./css/style.css";
// TODO(perf): Tailwind v4 emits one global CSS bundle from this import; page-level
// splitting needs a future migration (e.g. per-route @import) without visual changes.
import type { Metadata } from "next";
import GtmLazy from "@/components/Analytics/GtmLazy";
import { DM_Sans } from "next/font/google";
const dm_sans = DM_Sans({
  weight: ["400", "700"],
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "optional",
  preload: true,
  adjustFontFallback: true,
});
const siteTitle = process.env.SITE_NAME ?? "i-Robox";

/** Static metadata — avoids blocking TTFB on a cached DB round-trip for env-only SEO fields. */
export const metadata: Metadata = {
  title: `${siteTitle} | i-Robox`,
  description: "i-Robox – diecast models, collectibles & play. Shop online.",
  keywords: "diecast, collectibles, toys, i-Robox, hot wheels",
  icons: {
    icon: "/images/logo/logo-icon.svg",
    shortcut: "/images/logo/logo-icon.svg",
    apple: "/images/logo/logo1-removebg-preview.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() || null;
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body suppressHydrationWarning={true} className={`${dm_sans.className} ${dm_sans.variable}`}>
        {children}
        {gtmId ? <GtmLazy gtmId={gtmId} /> : null}
      </body>
    </html>
  );
}
