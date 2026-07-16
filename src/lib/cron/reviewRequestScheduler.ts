import { prisma } from "@/lib/prisma";
import { runReviewRequestEmails } from "@/lib/marketing/runReviewRequestEmails";

/** Stable Postgres advisory lock id for review-request job. */
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
      console.info("[review-request-scheduler] skipped — lock held by another process");
      return;
    }

    try {
      const result = await runReviewRequestEmails();
      if ("skipped" in result && result.skipped) {
        console.info("[review-request-scheduler] skipped:", result.reason);
      } else if ("sent" in result) {
        console.info(
          `[review-request-scheduler] scanned=${result.scanned} sent=${result.sent} failed=${result.failed}`
        );
      }
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
    }
  } catch (err) {
    console.error("[review-request-scheduler] run failed:", err);
  } finally {
    running = false;
  }
}

/**
 * Runs delayed review-request emails on an interval while the Node process is up.
 */
export function startReviewRequestScheduler() {
  if (intervalId || startupTimerId) return;
  if (process.env.REVIEW_REQUEST_SCHEDULER_ENABLED === "0") {
    console.info("[review-request-scheduler] disabled via REVIEW_REQUEST_SCHEDULER_ENABLED=0");
    return;
  }

  const minutes = Number(process.env.REVIEW_REQUEST_INTERVAL_MINUTES ?? 30);
  if (!Number.isFinite(minutes) || minutes < 5) {
    console.warn(
      "[review-request-scheduler] invalid REVIEW_REQUEST_INTERVAL_MINUTES — need integer >= 5"
    );
    return;
  }

  const ms = minutes * 60 * 1000;
  startupTimerId = setTimeout(() => void runWithLock(), 4 * 60 * 1000);
  intervalId = setInterval(() => void runWithLock(), ms);
  console.info(`[review-request-scheduler] active — first run in 4 min, then every ${minutes} min`);
}

export function stopReviewRequestScheduler() {
  if (startupTimerId) {
    clearTimeout(startupTimerId);
    startupTimerId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
