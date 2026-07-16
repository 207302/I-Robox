import { prisma } from "@/lib/prisma";
import {
  createPooledEmailTransporter,
  getSmtpErrorHint,
  isEmailConfigured,
  sendEmailWithTransporter,
} from "@/lib/email";
import {
  latestDropBroadcastEmailHtml,
  latestDropBroadcastEmailText,
  LATEST_DROP_BROADCAST_SUBJECT,
} from "@/lib/email/latestDropBroadcastEmail";
import {
  fetchLatestDropEmailProducts,
  latestDropShopUrl,
} from "@/lib/marketing/fetchLatestDropEmailProducts";

export type LatestDropBroadcastFailure = {
  email: string;
  name: string;
  error: string;
};

export type LatestDropBroadcastResult =
  | {
      ok: true;
      skipped: true;
      reason: "smtp_not_configured" | "no_signups" | "no_products" | "smtp_blocked";
      message?: string;
      failures?: LatestDropBroadcastFailure[];
      notAttempted?: LatestDropBroadcastFailure[];
      ranAt: string;
    }
  | {
      ok: true;
      recipients: number;
      sent: number;
      failed: number;
      failures: LatestDropBroadcastFailure[];
      /** Left in queue when a blocking SMTP error stopped the run. */
      notAttempted?: LatestDropBroadcastFailure[];
      productCount: number;
      smtpError?: string;
      ranAt: string;
    };

const SEND_CONCURRENCY = 5;

function failureMessage(err: unknown): string {
  const hint = getSmtpErrorHint(err);
  if (hint) return hint;
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Send failed";
}

/** Send latest-drop email to every notify-signup (products fetched fresh at send time). */
export async function runLatestDropBroadcast(): Promise<LatestDropBroadcastResult> {
  const ranAt = new Date().toISOString();

  if (!isEmailConfigured()) {
    return { ok: true, skipped: true, reason: "smtp_not_configured", ranAt };
  }

  const transporter = createPooledEmailTransporter();
  if (!transporter) {
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
    transporter.close();
    return { ok: true, skipped: true, reason: "no_signups", ranAt };
  }
  if (products.length === 0) {
    transporter.close();
    return { ok: true, skipped: true, reason: "no_products", ranAt };
  }

  const shopUrl = latestDropShopUrl();
  const queue = signups
    .map((s) => ({ email: s.email.trim(), full_name: s.full_name }))
    .filter((s) => s.email.length > 0);

  let sent = 0;
  const failures: LatestDropBroadcastFailure[] = [];
  let smtpError: string | null = null;

  async function sendOne(signup: { email: string; full_name: string }) {
    await sendEmailWithTransporter(transporter!, {
      to: signup.email,
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
  }

  async function worker() {
    while (queue.length > 0 && !smtpError) {
      const signup = queue.shift();
      if (!signup) break;

      try {
        await sendOne(signup);
        sent += 1;
      } catch (err) {
        const error = failureMessage(err);
        failures.push({
          email: signup.email,
          name: signup.full_name,
          error,
        });
        console.error("[latest-drop-broadcast] send failed", { email: signup.email, err });
        const hint = getSmtpErrorHint(err);
        if (hint) {
          smtpError = hint;
        }
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(SEND_CONCURRENCY, queue.length) }, () => worker())
    );
  } finally {
    transporter.close();
  }

  const notAttempted: LatestDropBroadcastFailure[] = smtpError
    ? queue.splice(0, queue.length).map((s) => ({
        email: s.email,
        name: s.full_name,
        error: "Not attempted — send stopped after SMTP block",
      }))
    : [];

  if (smtpError && sent === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "smtp_blocked",
      message: smtpError,
      ...(failures.length > 0 ? { failures } : {}),
      ...(notAttempted.length > 0 ? { notAttempted } : {}),
      ranAt,
    };
  }

  return {
    ok: true,
    recipients: signups.length,
    sent,
    failed: failures.length,
    failures,
    ...(notAttempted.length > 0 ? { notAttempted } : {}),
    productCount: products.length,
    ...(smtpError ? { smtpError } : {}),
    ranAt,
  };
}
