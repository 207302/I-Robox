import { sendEmail, isEmailConfigured, orderEmailTemplate } from "@/lib/email";
import { formatPrice } from "@/utils/formatePrice";

function refundTxnDisplay(refundTransactionId: string | null | undefined): string {
  const id = (refundTransactionId ?? "").trim();
  return id || "Not available";
}

function refundedAmountDisplay(refundedAmountPaise: number | null | undefined): string {
  if (typeof refundedAmountPaise === "number" && Number.isFinite(refundedAmountPaise)) {
    return formatPrice(refundedAmountPaise / 100);
  }
  return "Not available";
}

export async function sendRefundConfirmationEmail(input: {
  to: string;
  orderRef: string;
  refundTransactionId: string;
  refundedAmountPaise: number;
}) {
  if (!isEmailConfigured()) {
    return { ok: false as const, skipped: true as const };
  }

  const refundedDisplay = formatPrice(input.refundedAmountPaise / 100);
  const subject = `Refund processed — ${input.orderRef}`;
  const message = `Your refund has been processed. Refund transaction ID: ${input.refundTransactionId}. Refunded amount: ${refundedDisplay}.`;

  await sendEmail({
    to: input.to,
    subject,
    html: orderEmailTemplate({
      heading: "Refund confirmation",
      message,
      orderId: input.orderRef,
    }),
    text: `Refund confirmation\n\n${message}\n\nOrder: ${input.orderRef}`,
  });

  return { ok: true as const };
}

/** Customer email when an admin manually marks an order as partially refunded. */
export async function sendManualPartialRefundEmail(input: {
  to: string;
  orderRef: string;
  refundTransactionId?: string | null;
  refundedAmountPaise?: number | null;
}) {
  if (!isEmailConfigured()) {
    return { ok: false as const, skipped: true as const };
  }

  const refundTxn = refundTxnDisplay(input.refundTransactionId);
  const refundedDisplay = refundedAmountDisplay(input.refundedAmountPaise);
  const subject = `Partial Refund Processed — Order #${input.orderRef}`;
  const message = [
    `A partial refund has been processed for your order ${input.orderRef}.`,
    `Refund transaction ID: ${refundTxn}.`,
    `Refunded amount: ${refundedDisplay}.`,
    "Please note: the remaining balance on this order is non-refundable.",
  ].join(" ");

  await sendEmail({
    to: input.to,
    subject,
    html: orderEmailTemplate({
      heading: "Partial refund processed",
      message,
      orderId: input.orderRef,
    }),
    text: `Partial refund processed\n\n${message}\n\nOrder: ${input.orderRef}`,
  });

  return { ok: true as const };
}

/** Customer email when an admin manually marks an order as fully refunded. */
export async function sendManualFullRefundEmail(input: {
  to: string;
  orderRef: string;
  refundTransactionId?: string | null;
  refundedAmountPaise?: number | null;
}) {
  if (!isEmailConfigured()) {
    return { ok: false as const, skipped: true as const };
  }

  const refundTxn = refundTxnDisplay(input.refundTransactionId);
  const refundedDisplay = refundedAmountDisplay(input.refundedAmountPaise);
  const subject = `Refund Processed — Order #${input.orderRef}`;
  const message = [
    `Your order ${input.orderRef} has been fully refunded.`,
    `Refund transaction ID: ${refundTxn}.`,
    `Refunded amount: ${refundedDisplay}.`,
  ].join(" ");

  await sendEmail({
    to: input.to,
    subject,
    html: orderEmailTemplate({
      heading: "Refund processed",
      message,
      orderId: input.orderRef,
    }),
    text: `Refund processed\n\n${message}\n\nOrder: ${input.orderRef}`,
  });

  return { ok: true as const };
}
