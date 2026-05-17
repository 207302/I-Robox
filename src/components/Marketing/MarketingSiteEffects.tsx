"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePublicMarketing } from "@/hooks/usePublicMarketing";
import type { MarketingPopupPayload } from "@/lib/marketing/publicMarketingTypes";

const RETURNING_KEY = "irobox_returning_visitor";
const PREFILL_COUPON_KEY = "irobox_prefill_coupon";

function storageKeyForPopup(popupId: string, frequency: string) {
  if (frequency === "ONCE_PER_DEVICE") return `irobox_popup_device_${popupId}`;
  return `irobox_popup_session_${popupId}`;
}

export default function MarketingSiteEffects() {
  const { data, isLoading } = usePublicMarketing();
  const [popup, setPopup] = useState<MarketingPopupPayload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !data) return;

    const wasReturning = localStorage.getItem(RETURNING_KEY);
    if (!wasReturning) {
      if (data.firstVisitCouponCode) {
        sessionStorage.setItem(PREFILL_COUPON_KEY, data.firstVisitCouponCode);
      }
      localStorage.setItem(RETURNING_KEY, "1");
    }

    const p = data.popup;
    if (!p) {
      setPopup(null);
      return;
    }

    const key = storageKeyForPopup(p.id, p.frequency);
    const store = p.frequency === "ONCE_PER_DEVICE" ? localStorage : sessionStorage;
    if (p.frequency !== "EVERY_VISIT" && store.getItem(key)) {
      setPopup(null);
      return;
    }

    setPopup(p);
    const delay = Math.max(0, Number(p.delay_ms) || 0);
    const openTimer = window.setTimeout(() => {
      setOpen(true);
      if (p.frequency !== "EVERY_VISIT") store.setItem(key, "1");
    }, delay);

    return () => window.clearTimeout(openTimer);
  }, [data, isLoading]);

  useEffect(() => {
    if (!open || !popup) return;
    const autoCloseMs = Math.max(0, Number(popup.auto_close_ms) || 0);
    if (autoCloseMs <= 0) return;
    const t = window.setTimeout(() => setOpen(false), autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, popup]);

  if (!open || !popup) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-3 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketing-popup-title"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-sm text-meta-3 hover:bg-gray-1 hover:text-dark"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          ✕
        </button>
        {popup.image_url ? (
          <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-xl bg-gray-1">
                  <Image
                    src={popup.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 512px) 100vw, 512px"
                    loading="eager"
                    priority
                    unoptimized={
                      popup.image_url.startsWith("http://") || popup.image_url.startsWith("https://")
                    }
                  />
          </div>
        ) : null}
        <h2 id="marketing-popup-title" className="pr-8 text-lg font-semibold text-dark">
          {popup.title}
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-meta-3">{popup.body}</p>
        {popup.suggested_coupon_code ? (
          <p className="mt-3 text-sm font-medium text-dark">
            Code: <span className="text-blue">{popup.suggested_coupon_code}</span>
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {popup.cta_url && popup.cta_label ? (
            <Link
              href={popup.cta_url}
              className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark"
              onClick={() => setOpen(false)}
            >
              {popup.cta_label}
            </Link>
          ) : null}
          <button
            type="button"
            className="inline-flex rounded-lg border border-gray-3 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
