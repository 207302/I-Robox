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
      /** Left in this batch when a blocking SMTP error stopped the run. */
      notAttempted?: LatestDropBroadcastFailure[];
      productCount: number;
      smtpError?: string;
      offset: number;
      limit: number;
      nextOffset: number;
      remaining: number;
      done: boolean;
      ranAt: string;
    };

export const LATEST_DROP_BATCH_SIZE = 40;
const SEND_CONCURRENCY = 2;
const SEND_GAP_MS = 250;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function failureMessage(err: unknown): string {
  const hint = getSmtpErrorHint(err);
  if (hint) return hint;
  if (err instanceof Error && err.message.trim()) return err.message.trim().slice(0, 240);
  return "Send failed";
}

export function parseBroadcastBatchInput(body: Record<string, unknown> | null): {
  offset: number;
  limit: number;
} {
  const offsetRaw = Number(body?.offset ?? 0);
  const limitRaw = Number(body?.limit ?? LATEST_DROP_BATCH_SIZE);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(80, Math.max(1, Math.trunc(limitRaw)))
    : LATEST_DROP_BATCH_SIZE;
  return { offset, limit };
}

/** Send latest-drop email to a slice of notify-signups (products fetched fresh at send time). */
export async function runLatestDropBroadcast(input?: {
  offset?: number;
  limit?: number;
}): Promise<LatestDropBroadcastResult> {
  const ranAt = new Date().toISOString();
  const offset = Math.max(0, Math.trunc(input?.offset ?? 0));
  const limit = Math.min(
    80,
    Math.max(1, Math.trunc(input?.limit ?? LATEST_DROP_BATCH_SIZE))
  );

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
  const all = signups
    .map((s) => ({ email: s.email.trim(), full_name: s.full_name }))
    .filter((s) => s.email.length > 0);
  const batch = all.slice(offset, offset + limit);
  const queue = [...batch];

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
        await sleep(SEND_GAP_MS);
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
    if (batch.length > 0) {
      await Promise.all(
        Array.from({ length: Math.min(SEND_CONCURRENCY, batch.length) }, () => worker())
      );
    }
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

  const attempted = sent + failures.length;
  const nextOffset = offset + attempted;
  const remaining = Math.max(0, all.length - nextOffset);

  if (smtpError && sent === 0 && offset === 0) {
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
    recipients: all.length,
    sent,
    failed: failures.length,
    failures,
    ...(notAttempted.length > 0 ? { notAttempted } : {}),
    productCount: products.length,
    ...(smtpError ? { smtpError } : {}),
    offset,
    limit,
    nextOffset,
    remaining,
    done: remaining === 0,
    ranAt,
  };
}
