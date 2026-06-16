import { prisma } from "@/lib/prisma";
import { runShipmozoTrackingSync } from "@/lib/shipping/shipmozoTracking";

/** Stable Postgres advisory lock id for ShipMozo tracking sync. */
const ADVISORY_LOCK_ID = 82910422;

let intervalId: ReturnType<typeof setInterval> | null = null;
let startupTimerId: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function runWithLock() {
  if (running) return;
  running = true;
  try {
    const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS locked`;
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
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
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
  startupTimerId = setTimeout(() => void runWithLock(), 5 * 60 * 1000);
  intervalId = setInterval(() => void runWithLock(), ms);
  console.info(`[shipmozo-tracking-scheduler] active — first run in 5 min, then every ${minutes} min`);
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
