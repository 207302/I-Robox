import { prisma } from "@/lib/prisma";
import { runAbandonedCartReminders } from "@/lib/marketing/runAbandonedCartReminders";

/** Stable Postgres advisory lock id for abandoned-cart job (single runner across instances). */
const ADVISORY_LOCK_ID = 82910421;

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
      console.info("[abandoned-cart-scheduler] skipped — lock held by another process");
      return;
    }

    try {
      const result = await runAbandonedCartReminders();
      if ("skipped" in result && result.skipped) {
        console.info("[abandoned-cart-scheduler] skipped:", result.reason);
      } else if ("sent" in result) {
        console.info(
          `[abandoned-cart-scheduler] scanned=${result.scanned} sent=${result.sent} failed=${result.failed}`
        );
      }
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
    }
  } catch (err) {
    console.error("[abandoned-cart-scheduler] run failed:", err);
  } finally {
    running = false;
  }
}

/**
 * Runs abandoned-cart reminders on an interval while the Node process is up.
 * For Hostinger / hosts without hPanel cron or SSH.
 */
export function startAbandonedCartScheduler() {
  if (intervalId || startupTimerId) return;
  if (process.env.ABANDONED_CART_SCHEDULER_ENABLED === "0") {
    console.info("[abandoned-cart-scheduler] disabled via ABANDONED_CART_SCHEDULER_ENABLED=0");
    return;
  }

  const minutes = Number(process.env.ABANDONED_CART_INTERVAL_MINUTES ?? 30);
  if (!Number.isFinite(minutes) || minutes < 5) {
    console.warn(
      "[abandoned-cart-scheduler] invalid ABANDONED_CART_INTERVAL_MINUTES — need integer >= 5"
    );
    return;
  }

  const ms = minutes * 60 * 1000;
  startupTimerId = setTimeout(() => void runWithLock(), 3 * 60 * 1000);
  intervalId = setInterval(() => void runWithLock(), ms);
  console.info(`[abandoned-cart-scheduler] active — first run in 3 min, then every ${minutes} min`);
}

export function stopAbandonedCartScheduler() {
  if (startupTimerId) {
    clearTimeout(startupTimerId);
    startupTimerId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
