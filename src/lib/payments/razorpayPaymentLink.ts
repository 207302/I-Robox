import { getRazorpayClient, isRazorpayConfigured } from "@/lib/payments/razorpay";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { formatOrderReference } from "@/lib/orders/orderNumber";

export const PAYMENT_LINK_TTL_SECONDS = 36 * 60 * 60;

type PaymentLinkEntity = {
  id?: string;
  short_url?: string;
  expire_by?: number;
};

export async function createRazorpayPaymentLink(input: {
  orderId: string;
  orderNumber: string;
  amountInr: number;
  customerName: string;
  customerEmail?: string | null;
  customerPhone: string;
}): Promise<{ id: string; url: string; expiresAt: Date }> {
  if (!isRazorpayConfigured()) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  const amountPaise = Math.round(input.amountInr * 100);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    throw new Error("Payment amount is too small for a Razorpay payment link");
  }

  const expireBy = Math.floor(Date.now() / 1000) + PAYMENT_LINK_TTL_SECONDS;
  const razorpay = getRazorpayClient();
  const created = (await razorpay.paymentLink.create({
    amount: amountPaise,
    currency: "INR",
    accept_partial: false,
    expire_by: expireBy,
    reference_id: input.orderId.slice(0, 40),
    description: `Order ${formatOrderReference({ id: input.orderId, order_number: input.orderNumber })}`,
    customer: {
      name: input.customerName.slice(0, 100) || "Customer",
      contact: input.customerPhone.slice(0, 15),
      ...(input.customerEmail ? { email: input.customerEmail.slice(0, 255) } : {}),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: `${getSiteBaseUrl()}/orders/${input.orderId}`,
    callback_method: "get",
    notes: { order_id: input.orderId },
  })) as PaymentLinkEntity;

  const id = String(created.id ?? "").trim();
  const url = String(created.short_url ?? "").trim();
  if (!id || !url) {
    throw new Error("Razorpay did not return a payment link");
  }
  const expiresAt =
    typeof created.expire_by === "number" && created.expire_by > 0
      ? new Date(created.expire_by * 1000)
      : new Date((expireBy) * 1000);

  return { id, url, expiresAt };
}

export async function cancelRazorpayPaymentLink(paymentLinkId: string): Promise<void> {
  const id = paymentLinkId.trim();
  if (!id || !isRazorpayConfigured()) return;
  try {
    await getRazorpayClient().paymentLink.cancel(id);
  } catch (err) {
    console.error("[razorpay] payment link cancel failed", { paymentLinkId: id, err });
  }
}
