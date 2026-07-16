"use client";

import { useLayoutEffect, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_PREFIX = "scroll-restore:";
const REGION_ATTR = "data-scroll-restore";

type ScrollSnapshot = {
  windowY: number;
  regions: Record<string, number>;
};

type NavState = {
  lastRouteKey: string | null;
  pendingPopRestore: boolean;
  /** Cancel token for in-flight restore retries. */
  restoreGeneration: number;
};

const NAV_KEY = "__tronScrollNav__";
const POP_KEY = "__tronScrollPop__";
const memory = new Map<string, ScrollSnapshot>();

function getNav(): NavState {
  const w = window as Window & { [NAV_KEY]?: NavState };
  if (!w[NAV_KEY]) {
    w[NAV_KEY] = {
      lastRouteKey: null,
      pendingPopRestore: false,
      restoreGeneration: 0,
    };
  }
  return w[NAV_KEY];
}

function ensurePopListener() {
  const w = window as Window & { [POP_KEY]?: boolean };
  if (w[POP_KEY]) return;
  w[POP_KEY] = true;
  window.addEventListener("popstate", () => {
    getNav().pendingPopRestore = true;
  });
}

function routeKey(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
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

function saveSnapshot(key: string, snap?: ScrollSnapshot) {
  const next = snap ?? captureSnapshot();
  // Never clobber a good snapshot with an empty one (Next often resets scroll before unmount).
  const prev = memory.get(key) ?? readStored(key);
  if (!snapshotMeaningful(next) && prev && snapshotMeaningful(prev)) {
    return;
  }
  memory.set(key, next);
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
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
 * Keep re-applying until layout/images grow enough for the saved offsets,
 * or until we give up. Cancels previous restore when a new navigation starts.
 */
function restoreSnapshot(snap: ScrollSnapshot) {
  const nav = getNav();
  const generation = ++nav.restoreGeneration;
  const reenableSmooth = disableSmoothScroll();
  const timers: number[] = [];
  let observer: ResizeObserver | null = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    observer?.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
    reenableSmooth();
  };

  const tick = () => {
    if (generation !== getNav().restoreGeneration) {
      finish();
      return;
    }
    applySnapshot(snap);
    if (snapshotApplied(snap)) {
      finish();
    }
  };

  tick();
  requestAnimationFrame(() => {
    tick();
    requestAnimationFrame(tick);
  });

  const delays = [16, 50, 100, 200, 350, 500, 800, 1200, 1800, 2500];
  for (const ms of delays) {
    timers.push(window.setTimeout(tick, ms));
  }
  timers.push(window.setTimeout(finish, 3000));

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
  const key = routeKey(pathname, search);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    ensurePopListener();
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const persist = () => saveSnapshot(keyRef.current);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a[href]")) return;
      persist();
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a[href]")) return;
      persist();
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveSnapshot(keyRef.current);
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
        saveSnapshot(keyRef.current);
        ticking = false;
      });
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onRegionScroll, { passive: true, capture: true });
    window.addEventListener("pagehide", persist);

    // Initial capture for this route (may be 0 right after forward nav — OK).
    saveSnapshot(key);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onRegionScroll, true);
      window.removeEventListener("pagehide", persist);
      const y = window.scrollY || 0;
      const regions = readRegions();
      if (y > 0 || Object.values(regions).some((v) => v > 0)) {
        saveSnapshot(key, { windowY: y, regions });
      }
    };
  }, [key]);

  useLayoutEffect(() => {
    ensurePopListener();
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const nav = getNav();

    // Same-route remount (Suspense): don't jump to top; finish a pending back restore.
    if (nav.lastRouteKey === key) {
      if (nav.pendingPopRestore) {
        nav.pendingPopRestore = false;
        const snap = getSnapshot(key);
        if (snap && snapshotMeaningful(snap)) restoreSnapshot(snap);
      }
      return;
    }

    const isBack = nav.pendingPopRestore;
    nav.pendingPopRestore = false;

    if (isBack) {
      const snap = getSnapshot(key);
      if (snap && snapshotMeaningful(snap)) {
        restoreSnapshot(snap);
      } else {
        scrollWindowToTop();
      }
    } else if (nav.lastRouteKey !== null) {
      // Invalidate any in-flight restore from a previous back.
      nav.restoreGeneration += 1;
      scrollWindowToTop();
    }

    nav.lastRouteKey = key;
  }, [key]);

  return null;
}
