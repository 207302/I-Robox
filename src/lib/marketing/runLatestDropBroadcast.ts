import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  latestDropBroadcastEmailHtml,
  latestDropBroadcastEmailText,
  LATEST_DROP_BROADCAST_SUBJECT,
} from "@/lib/email/latestDropBroadcastEmail";
import {
  fetchLatestDropEmailProducts,
  latestDropShopUrl,
} from "@/lib/marketing/fetchLatestDropEmailProducts";

export type LatestDropBroadcastResult =
  | {
      ok: true;
      skipped: true;
      reason: "smtp_not_configured" | "no_signups" | "no_products";
      ranAt: string;
    }
  | {
      ok: true;
      recipients: number;
      sent: number;
      failed: number;
      productCount: number;
      ranAt: string;
    };

const SEND_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Send latest-drop email to every notify-signup (products fetched fresh at send time). */
export async function runLatestDropBroadcast(): Promise<LatestDropBroadcastResult> {
  const ranAt = new Date().toISOString();

  if (!isEmailConfigured()) {
    return { ok: true, skipped: true, reason: "smtp_not_configured", ranAt };
  }

  const [signups, products] = await Promise.all([
    prisma.marketing_notify_signups.findMany({
      orderBy: { created_at: "asc" },
      select: { email: true, full_name: true },
    }),
    fetchLatestDropEmailProducts(),
  ]);

  if (signups.length === 0) {
    return { ok: true, skipped: true, reason: "no_signups", ranAt };
  }
  if (products.length === 0) {
    return { ok: true, skipped: true, reason: "no_products", ranAt };
  }

  const shopUrl = latestDropShopUrl();
  let sent = 0;
  let failed = 0;

  for (const signup of signups) {
    const email = signup.email.trim();
    if (!email) continue;

    try {
      const result = await sendEmail({
        to: email,
        subject: LATEST_DROP_BROADCAST_SUBJECT,
        html: latestDropBroadcastEmailHtml({
          shopUrl,
          recipientName: signup.full_name,
          products,
        }),
        text: latestDropBroadcastEmailText({
          shopUrl,
          recipientName: signup.full_name,
          products,
        }),
      });
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error("[latest-drop-broadcast] send failed", { email, err });
    }

    await sleep(SEND_DELAY_MS);
  }

  return {
    ok: true,
    recipients: signups.length,
    sent,
    failed,
    productCount: products.length,
    ranAt,
  };
}
