import nodemailer from "nodemailer";
import type { AbandonedCartReminderLine } from "@/lib/email/abandonedCartReminder";
import {
  emailProductLinesTableHtml,
  emailProductLinesText,
  type EmailProductLine,
} from "@/lib/email/emailProductLines";

export type { AbandonedCartReminderLine, EmailProductLine };

export function isEmailConfigured() {
  return Boolean(
    process.env.EMAIL_SERVER_HOST &&
      process.env.EMAIL_SERVER_PORT &&
      process.env.EMAIL_SERVER_USER &&
      process.env.EMAIL_SERVER_PASSWORD &&
      process.env.EMAIL_FROM
  );
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  /** Plain-text part — improves deliverability and shows the link if HTML is clipped. */
  text?: string;
}) {
  if (!isEmailConfigured()) return { ok: false, skipped: true };

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
  });

  return { ok: true };
}

export function orderEmailTemplate(input: {
  heading: string;
  message: string;
  orderId: string;
  lines?: EmailProductLine[];
}) {
  const itemsHtml = input.lines?.length ? emailProductLinesTableHtml(input.lines) : "";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;color:#111">
    <h2 style="margin:0 0 0.5em">${escapeHtmlText(input.heading)}</h2>
    <p style="margin:0 0 1em">${escapeHtmlText(input.message)}</p>
    <p style="margin:0 0 0.5em"><b>Order:</b> ${escapeHtmlText(input.orderId)}</p>
    ${itemsHtml}
  </div>
  `;
}

function orderEmailTextBody(input: {
  heading: string;
  message: string;
  orderId: string;
  lines?: EmailProductLine[];
}) {
  const parts = [
    input.heading,
    "",
    input.message,
    "",
    `Order id: ${input.orderId}`,
  ];
  if (input.lines?.length) {
    parts.push("", "Items:", ...emailProductLinesText(input.lines));
  }
  return parts.join("\n");
}

function escapeHtmlAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Rich order / shipment update (customer-facing). */
export function orderUpdateCustomerEmailHtml(input: {
  orderId: string;
  orderUrl: string;
  blocksHtml: string[];
}) {
  const safeOrder = escapeHtmlAttr(input.orderId);
  const safeUrl = escapeHtmlAttr(input.orderUrl);
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;color:#111">
    <h2 style="margin:0 0 0.5em">Order update</h2>
    <p style="margin:0 0 1em">Your order <strong>${safeOrder}</strong> has an update.</p>
    ${input.blocksHtml.join("\n")}
    <p style="margin:1.5em 0 0">
      <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">View order</a>
    </p>
  </div>`;
}

function escapeHtmlText(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function abandonedCartReminderEmailHtml(input: {
  shopUrl: string;
  lines: AbandonedCartReminderLine[];
}) {
  const safeUrl = escapeHtmlAttr(input.shopUrl);
  const itemsHtml = input.lines.length > 0 ? emailProductLinesTableHtml(input.lines) : "";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;color:#111">
    <h2 style="margin:0 0 0.5em">Still interested?</h2>
    <p style="margin:0 0 1em">You left items in your cart at i-Robox. Come back when you’re ready to check out.</p>
    ${itemsHtml}
    <p style="margin:0"><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Continue shopping</a></p>
  </div>`;
}

/** Dedicated message so the set-password step is not buried in the order email. */
/** Single email: pending order + optional set-password block (avoids losing a 2nd message to spam/threading). */
export function orderPendingCustomerEmailHtml(input: {
  orderId: string;
  lines?: EmailProductLine[];
  passwordSetup?: { email: string; setupUrl: string };
}) {
  const orderPart = orderEmailTemplate({
    heading: "We received your order",
    message:
      "Your order has been created in a pending state. Please complete payment to confirm it.",
    orderId: input.orderId,
    lines: input.lines,
  });
  if (!input.passwordSetup) return orderPart;
  return `${orderPart}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0" />
  ${passwordSetupInviteEmailHtml(input.passwordSetup)}`;
}

export function orderPendingCustomerEmailText(input: {
  orderId: string;
  lines?: EmailProductLine[];
  passwordSetup?: { email: string; setupUrl: string };
}) {
  let t = orderEmailTextBody({
    heading: "We received your order",
    message: "Your order has been created in a pending state. Please complete payment to confirm it.",
    orderId: input.orderId,
    lines: input.lines,
  });
  if (input.passwordSetup) {
    t += `\n\n---\nWe created an account for ${input.passwordSetup.email}.\nSet your password (one-time link, 7 days):\n${input.passwordSetup.setupUrl}\n`;
  }
  return t;
}

/** Sent after a successful payment confirmation (e.g. Razorpay verified). */
export function orderConfirmedCustomerEmailHtml(input: {
  orderId: string;
  lines?: EmailProductLine[];
  passwordSetup?: { email: string; setupUrl: string };
}) {
  return orderEmailTemplate({
    heading: "Order placed successfully",
    message: "Your payment was successful and your order is now confirmed.",
    orderId: input.orderId,
    lines: input.lines,
  });
}

export function orderConfirmedCustomerEmailText(input: {
  orderId: string;
  lines?: EmailProductLine[];
  passwordSetup?: { email: string; setupUrl: string };
}) {
  return orderEmailTextBody({
    heading: "Order placed successfully",
    message: "Your payment was successful and your order is now confirmed.",
    orderId: input.orderId,
    lines: input.lines,
  });
}

/** Dedicated email for guest checkout accounts — set password to sign in and view orders. */
export function newGuestAccountPasswordEmailHtml(input: {
  email: string;
  setupUrl: string;
  orderId: string;
  loginUrl: string;
}) {
  const safeEmail = escapeHtmlText(input.email);
  const safeHref = escapeHtmlAttr(input.setupUrl);
  const safeLogin = escapeHtmlAttr(input.loginUrl);
  const safeOrderId = escapeHtmlText(input.orderId);
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.6;color:#111">
    <h2 style="margin:0 0 0.5em">Set your password to view your orders</h2>
    <p style="margin:0 0 1em">Thanks for shopping at i-Robox. We created an account for <strong>${safeEmail}</strong> when you checked out — no sign-up form needed.</p>
    <p style="margin:0 0 1em">Your order <strong>${safeOrderId}</strong> is confirmed. To sign in anytime and view your order history, set a password using the button below.</p>
    <p style="margin:0 0 1.5em">
      <a href="${safeHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
        Set password
      </a>
    </p>
    <p style="margin:0 0 1em">After setting your password, sign in here: <a href="${safeLogin}">${safeLogin}</a></p>
    <p style="margin:0;font-size:13px;color:#555">This link works once and expires in 7 days. If the button does not work, copy and paste this URL into your browser:<br/>
    <span style="word-break:break-all">${safeHref}</span></p>
  </div>
  `;
}

export function newGuestAccountPasswordEmailText(input: {
  email: string;
  setupUrl: string;
  orderId: string;
  loginUrl: string;
}) {
  return [
    "Set your password to view your orders",
    "",
    `We created an i-Robox account for ${input.email} when you checked out.`,
    `Your order ${input.orderId} is confirmed.`,
    "",
    "Set your password (one-time link, expires in 7 days):",
    input.setupUrl,
    "",
    `Then sign in to view your orders: ${input.loginUrl}`,
  ].join("\n");
}

export function passwordSetupInviteEmailHtml(input: { email: string; setupUrl: string }) {
  const safeEmail = input.email
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeHref = input.setupUrl.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.6;color:#111">
    <h2 style="margin:0 0 0.5em">Choose your password</h2>
    <p style="margin:0 0 1em">We created an account for <strong>${safeEmail}</strong> so you can track orders and sign in later.</p>
    <p style="margin:0 0 1em">Use the button below to set a password. This link works once and expires in 7 days.</p>
    <p style="margin:0 0 1.5em">
      <a href="${safeHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
        Set password
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#555">If the button does not work, copy and paste this link into your browser:<br/>
    <span style="word-break:break-all">${safeHref}</span></p>
  </div>
  `;
}

