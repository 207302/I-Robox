"use client";

import { useEffect, useState } from "react";
import WhatsAppFloatingButton from "./WhatsAppFloatingButton";

/** Defers the floating button until the browser is idle so it does not contend with LCP/INP. */
export default function WhatsAppFloatingDeferred({ phone }: { phone: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = () => setShow(true);
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(schedule, { timeout: 4000 });
      return () => win.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(schedule, 2500);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;
  return <WhatsAppFloatingButton phone={phone} />;
}
