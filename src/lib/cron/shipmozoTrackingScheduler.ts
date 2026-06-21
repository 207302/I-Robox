import { prisma } from "@/lib/prisma";
import { runShipmozoTrackingSync } from "@/lib/shipping/shipmozoTracking";
import { runShipmozoPendingOrderPush } from "@/lib/shipping/shipmozo";

/** Stable Postgres advisory lock id for ShipMozo tracking sync. */
const TRACKING_LOCK_ID = 82910422;
/** Separate lock for pushing unpaid ShipMozo orders. */
const PUSH_LOCK_ID = 82910423;

let intervalId: ReturnType<typeof setInterval> | null = null;
let startupTimerId: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function runPushWithLock() {
  try {
    const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${PUSH_LOCK_ID}) AS locked`;
    if (!rows[0]?.locked) return;
    try {
      await runShipmozoPendingOrderPush();
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${PUSH_LOCK_ID})`;
    }
  } catch (err) {
    console.error("[shipmozo-push-scheduler] run failed:", err);
  }
}

async function runWithLock() {
  if (running) return;
  running = true;
  try {
    const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${TRACKING_LOCK_ID}) AS locked`;
    const locked = rows[0]?.locked;
    if (!locked) {
      console.info("[shipmozo-tracking-scheduler] skipped — lock held by another process");
      return;
    }

    try {
      const result = await runShipmozoTrackingSync();
      console.info(
        `[shipmozo-tracking-scheduler] awb_scanned=${result.awbScanned} awb_discovered=${result.awbDiscovered} scanned=${result.scanned} synced=${result.synced} skipped=${result.skipped} failed=${result.failed}`
      );
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${TRACKING_LOCK_ID})`;
    }
  } catch (err) {
    console.error("[shipmozo-tracking-scheduler] run failed:", err);
  } finally {
    running = false;
  }
}

/**
 * Polls ShipMozo track-order while the Node process is up.
 * No host cron / SSH required (same pattern as abandoned-cart scheduler).
 */
export function startShipmozoTrackingScheduler() {
  if (intervalId || startupTimerId) return;
  if (process.env.SHIPMOZO_TRACKING_SCHEDULER_ENABLED === "0") {
    console.info("[shipmozo-tracking-scheduler] disabled via SHIPMOZO_TRACKING_SCHEDULER_ENABLED=0");
    return;
  }

  const minutes = Number(process.env.SHIPMOZO_TRACKING_INTERVAL_MINUTES ?? 30);
  if (!Number.isFinite(minutes) || minutes < 5) {
    console.warn(
      "[shipmozo-tracking-scheduler] invalid SHIPMOZO_TRACKING_INTERVAL_MINUTES — need integer >= 5"
    );
    return;
  }

  const ms = minutes * 60 * 1000;
  // Backfill stuck paid orders soon after deploy/restart, then on every tracking interval.
  startupTimerId = setTimeout(() => {
    void runPushWithLock();
    void runWithLock();
  }, 90 * 1000);
  intervalId = setInterval(() => {
    void runPushWithLock();
    void runWithLock();
  }, ms);
  console.info(
    `[shipmozo-tracking-scheduler] active — push+tracking first run in 90s, then every ${minutes} min`
  );
}

export function stopShipmozoTrackingScheduler() {
  if (startupTimerId) {
    clearTimeout(startupTimerId);
    startupTimerId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
