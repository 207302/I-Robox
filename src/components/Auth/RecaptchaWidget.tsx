"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { isRecaptchaEnabled, RECAPTCHA_SITE_KEY } from "@/lib/security/recaptchaPublic";

export type RecaptchaWidgetRef = {
  getToken: () => string | null;
  reset: () => void;
};

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; theme?: "light" | "dark" }
      ) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
      ready: (cb: () => void) => void;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="recaptcha/api.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("reCAPTCHA failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

const RecaptchaWidget = forwardRef<RecaptchaWidgetRef>(function RecaptchaWidget(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    getToken: () => {
      if (!isRecaptchaEnabled() || widgetIdRef.current == null) return null;
      return window.grecaptcha?.getResponse(widgetIdRef.current) || null;
    },
    reset: () => {
      if (widgetIdRef.current != null) {
        window.grecaptcha?.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!isRecaptchaEnabled() || !containerRef.current) return;

    let cancelled = false;

    void loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || widgetIdRef.current != null) return;
        window.grecaptcha?.ready(() => {
          if (cancelled || !containerRef.current || widgetIdRef.current != null) return;
          widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme: "light",
          });
        });
      })
      .catch(() => {
        /* Widget stays empty; server skips verify when not configured */
      });

    return () => {
      cancelled = true;
      widgetIdRef.current = null;
    };
  }, []);

  if (!isRecaptchaEnabled()) return null;

  return <div ref={containerRef} className="flex justify-center overflow-hidden" />;
});

export default RecaptchaWidget;
