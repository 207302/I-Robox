import { prisma } from "@/lib/prisma";
import { expireUnpaidPaymentLinkOrders } from "@/lib/orders/expireUnpaidPaymentLinkOrders";

const ADVISORY_LOCK_ID = 82910428;

let intervalId: ReturnType<typeof setInterval> | null = null;
let startupTimerId: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function runWithLock() {
  if (running) return;
  running = true;
  try {
    const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS locked`;
    if (!rows[0]?.locked) return;
    try {
      const result = await expireUnpaidPaymentLinkOrders();
      if (result.cancelled > 0) {
        console.info(
          `[payment-link-expire] scanned=${result.scanned} cancelled=${result.cancelled}`
        );
      }
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
    }
  } catch (err) {
    console.error("[payment-link-expire] run failed:", err);
  } finally {
    running = false;
  }
}

export function startPaymentLinkExpireScheduler() {
  if (intervalId || startupTimerId) return;
  startupTimerId = setTimeout(() => void runWithLock(), 4 * 60 * 1000);
  intervalId = setInterval(() => void runWithLock(), 15 * 60 * 1000);
  console.info("[payment-link-expire] active — first run in 4 min, then every 15 min");
}

export function stopPaymentLinkExpireScheduler() {
  if (startupTimerId) {
    clearTimeout(startupTimerId);
    startupTimerId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
