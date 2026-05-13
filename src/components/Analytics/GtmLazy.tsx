"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Same behavior as `@next/third-parties/google` GTM, but loads after window `load`
 * (`lazyOnload`) so it does not compete with LCP/critical rendering.
 */
export default function GtmLazy({
  gtmId,
  dataLayerName = "dataLayer",
  dataLayer,
  auth,
  preview,
  nonce,
}: {
  gtmId: string;
  dataLayerName?: string;
  dataLayer?: Record<string, unknown>;
  auth?: string;
  preview?: string;
  nonce?: string;
}) {
  useEffect(() => {
    if (typeof performance?.mark === "function") {
      performance.mark("mark_feature_usage", {
        detail: { feature: "irobox-gtm-lazy" },
      });
    }
  }, []);

  const scriptUrl = new URL("https://www.googletagmanager.com/gtm.js");
  scriptUrl.searchParams.set("id", gtmId);
  if (dataLayerName !== "dataLayer") {
    scriptUrl.searchParams.set("l", dataLayerName);
  }
  if (auth) scriptUrl.searchParams.set("gtm_auth", auth);
  if (preview) {
    scriptUrl.searchParams.set("gtm_preview", preview);
    scriptUrl.searchParams.set("gtm_cookies_win", "x");
  }

  const initHtml = `
      (function(w,l){
        w[l]=w[l]||[];
        w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
        ${dataLayer ? `w[l].push(${JSON.stringify(dataLayer)})` : ""}
      })(window,'${dataLayerName}');`;

  return (
    <>
      <Script
        id="_irobox-gtm-init"
        strategy="lazyOnload"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: initHtml }}
      />
      <Script
        id="_irobox-gtm"
        strategy="lazyOnload"
        src={scriptUrl.href}
        nonce={nonce}
        data-ntpc="GTM"
      />
    </>
  );
}
