import { normalizeEmail } from "@/lib/validation/input";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { sendEmail, type EmailAttachment } from "@/lib/email";

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
  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, html, text, attachments });
    } catch (err) {
      console.error("[order-email] send failed", { to, err });
    }
  }
}
