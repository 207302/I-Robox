import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { getReviewRequestSettings } from "@/lib/marketing/getReviewRequestSettings";
import { sendReviewRequestEmailForOrder } from "@/lib/orders/maybeSendReviewRequestEmail";
import { isEmailConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export type ReviewRequestRunResult =
  | {
      ok: true;
      skipped: true;
      reason: "disabled" | "smtp_not_configured";
    }
  | {
      ok: true;
      scanned: number;
      sent: number;
      failed: number;
      skippedAlreadyReviewed: number;
      skippedNoEmail: number;
      delayHours: number;
    };

const SCAN_LIMIT = 200;
const SEND_LIMIT = 80;

/**
 * Send review-request emails for delivered orders that still have unreviewed items.
 * Respects configured delay unless `ignoreDelay` is true (admin manual run).
 * Never emails customers who already reviewed every line item on the order.
 */
export async function runReviewRequestEmails(opts?: {
  ignoreDelay?: boolean;
}): Promise<ReviewRequestRunResult> {
  const settings = await getReviewRequestSettings();
  if (!settings.enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  if (!isEmailConfigured()) {
    return { ok: true, skipped: true, reason: "smtp_not_configured" };
  }

  const delayMs = opts?.ignoreDelay ? 0 : settings.delayMs;
  const deliveredBefore = new Date(Date.now() - delayMs);

  const candidates = await prisma.orders.findMany({
    where: {
      status: "DELIVERED",
      review_request_email_sent_at: null,
      order_items: { some: { reviews: { none: {} } } },
    },
    orderBy: { updated_at: "asc" },
    take: SCAN_LIMIT,
    select: {
      id: true,
      updated_at: true,
      shipment_updated_at: true,
      customers: { select: { email: true } },
      shipments: { select: { delivered_at: true } },
    },
  });

  const due = candidates
    .filter((order) => {
      const deliveredAt =
        order.shipments?.delivered_at ?? order.shipment_updated_at ?? order.updated_at;
      return deliveredAt.getTime() <= deliveredBefore.getTime();
    })
    .slice(0, SEND_LIMIT);

  let sent = 0;
  let failed = 0;
  let skippedAlreadyReviewed = 0;
  let skippedNoEmail = 0;

  for (const order of due) {
    const email = order.customers?.email ?? null;
    if (!email || isSyntheticPhoneSignupEmail(email)) {
      skippedNoEmail += 1;
      continue;
    }

    try {
      const result = await sendReviewRequestEmailForOrder(order.id);
      if ("sentTo" in result) {
        sent += 1;
      } else if ("skipped" in result && result.skipped) {
        if (result.reason === "no_unreviewed_items") skippedAlreadyReviewed += 1;
        else if (result.reason === "no_email") skippedNoEmail += 1;
      }
    } catch (err) {
      failed += 1;
      console.error("[review-request-run] send failed", { orderId: order.id, err });
    }
  }

  return {
    ok: true,
    scanned: due.length,
    sent,
    failed,
    skippedAlreadyReviewed,
    skippedNoEmail,
    delayHours: settings.delayHours,
  };
}
