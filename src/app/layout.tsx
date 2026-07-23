import "./css/style.css";

// TODO(perf): Tailwind v4 emits one global CSS bundle from this import; page-level

// splitting needs a future migration (e.g. per-route @import) without visual changes.

import type { Metadata } from "next";

import GtmLazy from "@/components/Analytics/GtmLazy";



const CLASH_DISPLAY_STYLESHEET =

  "https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap";



const siteTitle = process.env.SITE_NAME ?? "i-Robox";



/** Static metadata — avoids blocking TTFB on a cached DB round-trip for env-only SEO fields. */

export const metadata: Metadata = {

  title: `${siteTitle} | i-Robox`,

  description: "i-Robox – diecast models, collectibles & play. Shop online.",

  keywords: "diecast, collectibles, toys, i-Robox, hot wheels",

  icons: {

    icon: "/images/favicon.png",

    shortcut: "/images/favicon.png",

    apple: "/images/favicon.png",

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

        {/* Must run before first paint: mobile browsers apply native
            scroll-restoration on back/reload earlier and more aggressively than
            desktop. ScrollOnNavigate re-asserts this later, but it mounts after
            hydration (inside Suspense) — too late to preempt the native jump. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if("scrollRestoration"in history)history.scrollRestoration="manual"}catch(e){}',
          }}
        />

        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />

        <link href={CLASH_DISPLAY_STYLESHEET} rel="stylesheet" />

        <link rel="preconnect" href="https://res.cloudinary.com" />

        <link rel="dns-prefetch" href="https://res.cloudinary.com" />

        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />

        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18293191068"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'AW-18293191068');`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `     function gtagSendEvent(url) {
       var callback = function () {
         if (typeof url === 'string') {
           window.location = url;
         }
       };
       gtag('event', 'conversion_event_purchase', {
         'event_callback': callback,
         'event_timeout': 2000,
       });
       return false;
     }`,
          }}
        />

      </head>

      <body suppressHydrationWarning={true} className="font-sans antialiased">

        {children}

        {gtmId ? <GtmLazy gtmId={gtmId} /> : null}

      </body>

    </html>

  );

}

