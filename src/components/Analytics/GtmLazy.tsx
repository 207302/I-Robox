"use client";

import { useEffect } from "react";

/**
 * GTM loads after window `load` + idle — keeps third-party tags (e.g. i.edwardmartin.com
 * nb-collector injected via GTM) off the critical path. Configure those tags in GTM to
 * fire on "Window Loaded", not "DOM Ready".
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

    const initHtml = `(function(w,l){
        w[l]=w[l]||[];
        w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
        ${dataLayer ? `w[l].push(${JSON.stringify(dataLayer)})` : ""}
      })(window,'${dataLayerName}');`;

    const inject = () => {
      if (document.getElementById("_irobox-gtm")) return;

      const init = document.createElement("script");
      init.id = "_irobox-gtm-init";
      init.text = initHtml;
      if (nonce) init.setAttribute("nonce", nonce);
      document.body.appendChild(init);

      const gtm = document.createElement("script");
      gtm.id = "_irobox-gtm";
      gtm.async = true;
      gtm.src = scriptUrl.href;
      if (nonce) gtm.setAttribute("nonce", nonce);
      gtm.setAttribute("data-ntpc", "GTM");
      document.body.appendChild(gtm);
    };

    const schedule = () => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(inject, { timeout: 3000 });
      } else {
        window.setTimeout(inject, 1500);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }
  }, [gtmId, dataLayerName, dataLayer, auth, preview, nonce]);

  return null;
}
