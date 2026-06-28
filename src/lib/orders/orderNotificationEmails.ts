import { normalizeEmail } from "@/lib/validation/input";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import {
  getMissingEmailEnvKeys,
  isEmailConfigured,
  sendEmail,
  type EmailAttachment,
} from "@/lib/email";

/** Distinct real inboxes to notify for an order (checkout form + registered account). */
export function collectOrderNotificationEmails(
  checkoutFormEmail: string,
  accountEmail?: string | null
): string[] {
  const emails = new Set<string>();
  const form = normalizeEmail(checkoutFormEmail);
  if (form && !isSyntheticPhoneSignupEmail(form)) {
    emails.add(form);
  }
  if (accountEmail) {
    const account = normalizeEmail(accountEmail);
    if (account && !isSyntheticPhoneSignupEmail(account)) {
      emails.add(account);
    }
  }
  return [...emails];
}

export async function sendEmailToRecipients(input: {
  recipients: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}) {
  const { recipients, subject, html, text, attachments } = input;

  if (recipients.length === 0) {
    console.warn("[order-email] no recipients — nothing sent", { subject });
    return { ok: false as const, skipped: true as const, reason: "no_recipients" as const };
  }

  if (!isEmailConfigured()) {
    console.error("[order-email] SMTP not configured — emails not sent", {
      subject,
      recipients,
      missingEnv: getMissingEmailEnvKeys(),
    });
    return { ok: false as const, skipped: true as const, reason: "smtp_not_configured" as const };
  }

  console.info("[order-email] sending to recipients", {
    subject,
    recipients,
    attachmentCount: attachments?.length ?? 0,
  });

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      const result = await sendEmail({ to, subject, html, text, attachments });
      if (result.ok) {
        sent += 1;
      } else if ("skipped" in result && result.skipped) {
        console.error("[order-email] send skipped", { to, subject, result });
        failed += 1;
      }
    } catch (err) {
      failed += 1;
      console.error("[order-email] send failed", { to, subject, err });
    }
  }

  console.info("[order-email] batch complete", { subject, sent, failed, total: recipients.length });
  return { ok: failed === 0, sent, failed };
}
