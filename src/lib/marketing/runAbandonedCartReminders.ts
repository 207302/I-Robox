import { prisma } from "@/lib/prisma";
import { sendEmail, abandonedCartReminderEmailHtml, isEmailConfigured } from "@/lib/email";
import {
  abandonedCartItemSelect,
  abandonedCartReminderTextLines,
  buildAbandonedCartReminderLines,
} from "@/lib/email/abandonedCartReminder";
import { getAbandonedCartSettings } from "@/lib/marketing/getAbandonedCartSettings";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";

export type AbandonedCartRunResult =
  | {
      ok: true;
      skipped: true;
      reason: "abandoned_cart_reminders_disabled" | "smtp_not_configured";
      source: string;
      ranAt: string;
    }
  | {
      ok: true;
      scanned: number;
      sent: number;
      failed: number;
      idleHours: number;
      source: string;
      cutoff: string;
      ranAt: string;
    };

/** Sends one reminder email per eligible logged-in cart (idle past configured time). */
export async function runAbandonedCartReminders(): Promise<AbandonedCartRunResult> {
  const ranAt = new Date().toISOString();
  const settings = await getAbandonedCartSettings();

  if (!settings.enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "abandoned_cart_reminders_disabled",
      source: settings.source,
      ranAt,
    };
  }

  if (!isEmailConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: "smtp_not_configured",
      source: settings.source,
      ranAt,
    };
  }

  const cutoff = new Date(Date.now() - settings.idleMs);

  const carts = await prisma.carts.findMany({
    where: {
      status: "ACTIVE",
      customer_id: { not: null },
      abandoned_reminder_sent_at: null,
      updated_at: { lt: cutoff },
      cart_items: { some: {} },
    },
    select: {
      id: true,
      customers: { select: { email: true } },
      cart_items: {
        take: 6,
        select: abandonedCartItemSelect,
      },
    },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  const siteBase = getSiteBaseUrl();
  const shopUrl = `${siteBase}/shop`;

  for (const c of carts) {
    const email = c.customers?.email;
    if (!email || isSyntheticPhoneSignupEmail(email)) continue;

    const lines = buildAbandonedCartReminderLines(c.cart_items, siteBase);
    const textLines = abandonedCartReminderTextLines(lines);

    try {
      await sendEmail({
        to: email,
        subject: "You left items in your cart — i-Robox",
        html: abandonedCartReminderEmailHtml({ shopUrl, lines }),
        text: `You still have items saved in your cart at i-Robox.\n\n${textLines.join("\n")}\n\nContinue: ${shopUrl}`,
      });
      await prisma.carts.update({
        where: { id: c.id },
        data: { abandoned_reminder_sent_at: new Date() },
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      console.error("[abandoned-cart] send failed", c.id, e);
    }
  }

  return {
    ok: true,
    scanned: carts.length,
    sent,
    failed,
    idleHours: settings.idleHours,
    source: settings.source,
    cutoff: cutoff.toISOString(),
    ranAt,
  };
}
