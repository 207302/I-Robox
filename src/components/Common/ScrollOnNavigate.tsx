"use client";

import { useLayoutEffect, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_PREFIX = "scroll-restore:";
const REGION_ATTR = "data-scroll-restore";

type ScrollSnapshot = {
  windowY: number;
  regions: Record<string, number>;
};

type NavState = {
  /** Cancel token for in-flight restore retries. */
  restoreGeneration: number;
  /**
   * True while a restore is replaying scroll. Restore repeatedly applies a
   * clamped position while infinite-scroll content is still loading; those
   * programmatic scrolls fire real scroll events, and saving them would
   * overwrite the good snapshot with a transient clamped-to-bottom value.
   */
  restoring: boolean;
};

const NAV_KEY = "__tronScrollNav__";
const memory = new Map<string, ScrollSnapshot>();

/**
 * Opt-in diagnostics for on-device (mobile) testing without spamming normal
 * users: run `localStorage.setItem("scroll-debug", "1")` in the console (or
 * remote inspector), reload, and watch for `[scroll-debug]` lines.
 */
let debugEnabled: boolean | null = null;
function scrollDebug(msg: string, data?: Record<string, unknown>) {
  if (debugEnabled === null) {
    try {
      debugEnabled = localStorage.getItem("scroll-debug") === "1";
    } catch {
      debugEnabled = false;
    }
  }
  if (!debugEnabled) return;
  console.log(
    `[scroll-debug] ${msg}${data === undefined ? "" : " " + JSON.stringify(data)}`
  );
}

function getNav(): NavState {
  const w = window as Window & { [NAV_KEY]?: NavState };
  if (!w[NAV_KEY]) {
    w[NAV_KEY] = {
      restoreGeneration: 0,
      restoring: false,
    };
  }
  return w[NAV_KEY];
}

function routeKey(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

function liveRouteKey(): string {
  const params = new URLSearchParams(window.location.search);
  return routeKey(window.location.pathname, params.toString());
}

function readRegions(): Record<string, number> {
  const regions: Record<string, number> = {};
  document.querySelectorAll<HTMLElement>(`[${REGION_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(REGION_ATTR);
    if (!id) return;
    regions[id] = el.scrollTop;
  });
  return regions;
}

function captureSnapshot(): ScrollSnapshot {
  return {
    windowY: window.scrollY || window.pageYOffset || 0,
    regions: readRegions(),
  };
}

function snapshotMeaningful(snap: ScrollSnapshot): boolean {
  if (snap.windowY > 0) return true;
  return Object.values(snap.regions).some((y) => y > 0);
}

function saveSnapshot(key: string, snap?: ScrollSnapshot, reason?: string) {
  // While a restore is replaying scroll, every position is transient (often
  // clamped to the bottom of a not-yet-fully-loaded infinite-scroll list).
  // Saving those would corrupt the very snapshot being restored.
  if (getNav().restoring) {
    scrollDebug("save-skipped (restoring)", { key, reason: reason ?? "scroll" });
    return;
  }
  const next = snap ?? captureSnapshot();
  // Never clobber a good snapshot with an empty one (Next often resets scroll before unmount).
  const prev = memory.get(key) ?? readStored(key);
  if (!snapshotMeaningful(next) && prev && snapshotMeaningful(prev)) {
    return;
  }
  memory.set(key, next);
  // Written synchronously on every save: mobile browsers can suspend the tab
  // and tear down the JS context, leaving sessionStorage as the only survivor.
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
  scrollDebug("save", { key, y: next.windowY, reason: reason ?? "scroll" });
}

function readStored(key: string): ScrollSnapshot | undefined {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ScrollSnapshot;
    if (!parsed || typeof parsed !== "object") return undefined;
    return {
      windowY: Number(parsed.windowY) || 0,
      regions:
        parsed.regions && typeof parsed.regions === "object" ? parsed.regions : {},
    };
  } catch {
    return undefined;
  }
}

function getSnapshot(key: string): ScrollSnapshot | undefined {
  return memory.get(key) ?? readStored(key);
}

function disableSmoothScroll() {
  const html = document.documentElement;
  const prevAttr = html.getAttribute("data-scroll-behavior");
  const prevInline = html.style.scrollBehavior;
  html.setAttribute("data-scroll-behavior", "auto");
  html.style.scrollBehavior = "auto";
  return () => {
    if (prevAttr == null) html.removeAttribute("data-scroll-behavior");
    else html.setAttribute("data-scroll-behavior", prevAttr);
    html.style.scrollBehavior = prevInline;
  };
}

function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function applySnapshot(snap: ScrollSnapshot) {
  const maxWindow = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight
  );
  window.scrollTo({
    top: Math.min(Math.max(0, snap.windowY), maxWindow),
    left: 0,
    behavior: "auto",
  });

  for (const [id, top] of Object.entries(snap.regions)) {
    const el = document.querySelector<HTMLElement>(
      `[${REGION_ATTR}="${escapeSelectorValue(id)}"]`
    );
    if (!el) continue;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = Math.min(Math.max(0, top), max);
  }
}

function snapshotApplied(snap: ScrollSnapshot): boolean {
  const windowY = window.scrollY || 0;
  if (snap.windowY > 0) {
    const maxWindow = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    if (snap.windowY > maxWindow + 4) return false;
    if (Math.abs(windowY - Math.min(snap.windowY, maxWindow)) > 4) return false;
  }

  for (const [id, top] of Object.entries(snap.regions)) {
    if (top <= 0) continue;
    const el = document.querySelector<HTMLElement>(
      `[${REGION_ATTR}="${escapeSelectorValue(id)}"]`
    );
    if (!el) return false;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    if (top > max + 4) return false;
    if (Math.abs(el.scrollTop - Math.min(top, max)) > 4) return false;
  }
  return true;
}

/**
 * Keep re-applying until layout/images/infinite-scroll pages grow enough for
 * the saved offsets, or until the page stops growing. Cancels when a new
 * navigation starts or the user takes over scrolling.
 */
function restoreSnapshot(snap: ScrollSnapshot) {
  const nav = getNav();
  const generation = ++nav.restoreGeneration;
  nav.restoring = true;
  const reenableSmooth = disableSmoothScroll();
  const timers: number[] = [];
  let observer: ResizeObserver | null = null;
  let finished = false;
  let idleDeadline: number | null = null;
  let lastHeight = 0;

  const finish = () => {
    if (finished) return;
    finished = true;
    // Only unlock saves if no newer restore has taken over the flag.
    if (generation === getNav().restoreGeneration) nav.restoring = false;
    observer?.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
    if (idleDeadline != null) window.clearTimeout(idleDeadline);
    window.removeEventListener("wheel", onUserScroll);
    window.removeEventListener("touchstart", onUserScroll);
    reenableSmooth();
  };

  // The user grabbing the page mid-restore wins over the retry loop.
  const onUserScroll = () => {
    scrollDebug("restore-cancelled (user scroll)");
    finish();
  };

  // Give up only after the page has stopped growing for a while. A fixed
  // deadline loses to infinite-scroll lists that reload page-by-page on
  // slow (mobile/dev) connections; each height increase buys more time.
  const armIdleDeadline = () => {
    if (idleDeadline != null) window.clearTimeout(idleDeadline);
    idleDeadline = window.setTimeout(finish, 12000);
  };

  const tick = () => {
    if (finished) return;
    if (generation !== getNav().restoreGeneration) {
      finish();
      return;
    }
    const height = document.documentElement.scrollHeight;
    if (height !== lastHeight) {
      lastHeight = height;
      armIdleDeadline();
    }
    applySnapshot(snap);
    if (snapshotApplied(snap)) {
      scrollDebug("restore-applied", { target: snap.windowY, actual: window.scrollY });
      finish();
    }
  };

  armIdleDeadline();
  window.addEventListener("wheel", onUserScroll, { passive: true });
  window.addEventListener("touchstart", onUserScroll, { passive: true });

  tick();
  requestAnimationFrame(() => {
    tick();
    requestAnimationFrame(tick);
  });

  const delays = [16, 50, 100, 200, 350, 500, 800, 1200, 1800, 2500];
  for (const ms of delays) {
    timers.push(window.setTimeout(tick, ms));
  }
  // Absolute cap so a pathological layout can't hold the scroll hostage.
  timers.push(window.setTimeout(finish, 45000));

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => tick());
    observer.observe(document.documentElement);
    document.querySelectorAll(`[${REGION_ATTR}]`).forEach((el) => observer!.observe(el));
  }
}

function scrollWindowToTop() {
  const reenable = disableSmoothScroll();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.querySelectorAll<HTMLElement>(`[${REGION_ATTR}]`).forEach((el) => {
    el.scrollTop = 0;
  });
  window.setTimeout(reenable, 50);
}

/**
 * Manual scroll restoration for App Router:
 * - save window + `[data-scroll-restore]` panes before leaving a route
 * - restore on browser back/forward
 * - scroll to top on forward navigations
 */
export default function ScrollOnNavigate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  // Hook-derived key drives WHEN effects re-run; the actual save/restore
  // identity always comes from liveRouteKey() (window.location), because raw
  // history.replaceState (shop filter sync) updates the URL without ever
  // updating usePathname()/useSearchParams().
  const key = routeKey(pathname, search);

  useEffect(() => {
    // Re-assert (already set pre-paint by the inline script in the root
    // layout); some browsers reset it across bfcache restores.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Log-only: lets on-device debugging show how popstate timing relates to
    // the restore decision (iOS swipe-back fires it on gesture completion).
    // Deliberately NOT used to gate restoration — see comment in the layout
    // effect below.
    const onPopState = () => scrollDebug("popstate", { url: liveRouteKey() });
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const persist = (reason: string) => saveSnapshot(liveRouteKey(), undefined, reason);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a[href]")) return;
      persist("link-pointerdown");
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a[href]")) return;
      persist("link-click");
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveSnapshot(liveRouteKey());
        ticking = false;
      });
    };

    // Nested panes (shop products) scroll independently of window.
    const onRegionScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.hasAttribute(REGION_ATTR)) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveSnapshot(liveRouteKey());
        ticking = false;
      });
    };

    const onPageHide = () => persist("pagehide");
    // Mobile safety net: app switch / screen lock / new tab often only fires
    // visibilitychange→hidden (pagehide is unreliable there), and the JS
    // context may be suspended right after — last chance to hit sessionStorage.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist("visibilitychange");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onRegionScroll, { passive: true, capture: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Initial capture for this route (may be 0 right after forward nav — OK).
    saveSnapshot(liveRouteKey(), undefined, "mount");

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onRegionScroll, true);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [key]);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const nav = getNav();
    // Identity is always the live URL, never the (possibly stale) hook key.
    const liveKey = liveRouteKey();

    // Existence-based restoration: a saved snapshot for the live URL is the
    // only signal. If one exists, restore into it; otherwise land at the top.
    // No back/forward direction detection — that race is what kept sending
    // real Back presses to the top even though the snapshot was in memory.
    const snap = getSnapshot(liveKey);
    const willRestore = !!(snap && snapshotMeaningful(snap));
    scrollDebug("navigate", {
      key: liveKey,
      willRestore,
      targetY: snap?.windowY ?? null,
      fromMemory: memory.has(liveKey),
    });

    if (willRestore) {
      restoreSnapshot(snap!);
    } else {
      // Cancel any in-flight restore from a previous navigation before topping.
      nav.restoreGeneration += 1;
      scrollWindowToTop();
    }
  }, [key]);

  return null;
}
