"use client";

import { useEffect, useState } from "react";
import LaunchNotifyPopup from "./LaunchNotifyPopup";

/** Defers the launch notify popup until idle so it does not affect LCP. */
export default function LaunchNotifyPopupDeferred() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = () => setShow(true);
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(schedule, { timeout: 3000 });
      return () => win.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(schedule, 1500);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;
  return <LaunchNotifyPopup />;
}
