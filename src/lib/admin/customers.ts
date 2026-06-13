import { prisma } from "@/lib/prisma";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import {
  generatePasswordSetupSecret,
  PASSWORD_SETUP_TTL_MS,
} from "@/lib/auth/passwordSetupToken";
import { sendEmail } from "@/lib/email";
import { getSiteBaseUrl } from "@/lib/siteUrl";

export type AdminCustomerRow = {
  id: string;
  name: string | null;
  email: string;
  displayEmail: string | null;
  phone: string | null;
  isActive: boolean;
  googleSignIn: boolean;
  orderCount: number;
  createdAt: string;
  createdAtLabel: string;
};

function formatDateTimeIst(value: Date) {
  return value.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function mapCustomerToAdminRow(customer: {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  google_sub: string | null;
  created_at: Date;
  _count: { orders: number };
}): AdminCustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    displayEmail: displayEmailForCustomer(customer.email),
    phone: customer.phone,
    isActive: customer.is_active,
    googleSignIn: Boolean(customer.google_sub),
    orderCount: customer._count.orders,
    createdAt: customer.created_at.toISOString(),
    createdAtLabel: formatDateTimeIst(customer.created_at),
  };
}

export async function sendCustomerPasswordResetEmail(customerId: string) {
  const customer = await prisma.customers.findUnique({
    where: { id: customerId },
    select: { id: true, email: true },
  });
  if (!customer) return { ok: false as const, error: "Customer not found", status: 404 };

  const deliveryEmail = displayEmailForCustomer(customer.email);
  if (!deliveryEmail || isSyntheticPhoneSignupEmail(customer.email)) {
    return {
      ok: false as const,
      error: "This customer has no registered email address for password reset.",
      status: 400,
    };
  }

  const { raw, token_hash } = generatePasswordSetupSecret();
  const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.customer_password_setup_tokens.deleteMany({
      where: { customer_id: customer.id, used_at: null },
    });
    await tx.customer_password_setup_tokens.create({
      data: {
        customer_id: customer.id,
        token_hash,
        expires_at: expiresAt,
      },
    });
  });

  const setupUrl = `${getSiteBaseUrl()}/set-password?token=${encodeURIComponent(raw)}`;
  const emailResult = await sendEmail({
    to: deliveryEmail,
    subject: "Reset your i-Robox password",
    html: passwordResetInviteEmailHtml({ email: deliveryEmail, setupUrl }),
    text: [
      "Reset your i-Robox password",
      "",
      `We received a request to reset the password for ${deliveryEmail}.`,
      "",
      "Set a new password (one-time link, expires in 7 days):",
      setupUrl,
    ].join("\n"),
  }).catch(() => ({ ok: false, skipped: true }));

  return {
    ok: true as const,
    sentTo: deliveryEmail,
    emailSent: !emailResult?.skipped,
  };
}

export function passwordResetInviteEmailHtml(input: { email: string; setupUrl: string }) {
  const safeEmail = input.email
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeHref = input.setupUrl.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.6;color:#111">
    <h2 style="margin:0 0 0.5em">Reset your password</h2>
    <p style="margin:0 0 1em">Use the link below to set a new password for your i-Robox account (<strong>${safeEmail}</strong>).</p>
    <p style="margin:0 0 1em">This link works once and expires in 7 days.</p>
    <p style="margin:0 0 1.5em">
      <a href="${safeHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
        Set new password
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#555">If the button does not work, copy and paste this link into your browser:<br/>
    <span style="word-break:break-all">${safeHref}</span></p>
  </div>
  `;
}
