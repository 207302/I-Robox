import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CheckoutContext } from "@/lib/checkout/buildCheckoutContext";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCheckoutContext(value: unknown): CheckoutContext | null {
  if (!isRecord(value)) return null;
  const lineItemsRaw = value.lineItems;
  if (!Array.isArray(lineItemsRaw) || lineItemsRaw.length === 0) return null;
  if (typeof value.total !== "number" || !Number.isFinite(value.total)) return null;
  if (typeof value.subtotal !== "number" || typeof value.shipping !== "number") return null;
  if (typeof value.discount !== "number") return null;
  if (!isRecord(value.address)) return null;
  const address = value.address;
  if (
    typeof address.full_name !== "string" ||
    typeof address.phone !== "string" ||
    typeof address.email !== "string" ||
    typeof address.line1 !== "string" ||
    typeof address.city !== "string" ||
    typeof address.state !== "string" ||
    typeof address.postal_code !== "string" ||
    typeof address.country !== "string"
  ) {
    return null;
  }

  const lineItems: CheckoutContext["lineItems"] = [];
  for (const item of lineItemsRaw) {
    if (!isRecord(item)) return null;
    if (typeof item.productId !== "string" || typeof item.productName !== "string") return null;
    if (typeof item.unitPrice !== "number" || typeof item.quantity !== "number") return null;
    if (typeof item.subtotal !== "number" || typeof item.shippingPerUnit !== "number") return null;
    lineItems.push({
      productId: item.productId,
      productName: item.productName,
      sku: typeof item.sku === "string" ? item.sku : null,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      shippingPerUnit: item.shippingPerUnit,
    });
  }

  const coupon =
    isRecord(value.coupon) && typeof value.coupon.id === "string" && typeof value.coupon.code === "string"
      ? { id: value.coupon.id, code: value.coupon.code }
      : null;

  const setup = isRecord(value.newAccountPasswordSetup) ? value.newAccountPasswordSetup : null;
  const linkedAs = value.checkoutLinkedAs;
  const checkoutLinkedAs =
    linkedAs === "session" || linkedAs === "existing_customer" || linkedAs === "new_customer"
      ? linkedAs
      : "existing_customer";

  return {
    checkoutUserId: typeof value.checkoutUserId === "string" ? value.checkoutUserId : null,
    checkoutEmail: typeof value.checkoutEmail === "string" ? value.checkoutEmail : address.email,
    accountEmail: typeof value.accountEmail === "string" ? value.accountEmail : null,
    checkoutLinkedAs,
    newAccountPasswordSetup:
      setup && typeof setup.setupUrl === "string" ? { setupUrl: setup.setupUrl } : null,
    lineItems,
    coupon,
    shipping: value.shipping,
    subtotal: value.subtotal,
    discount: value.discount,
    total: value.total,
    address: {
      full_name: address.full_name,
      phone: address.phone,
      email: address.email,
      line1: address.line1,
      line2: typeof address.line2 === "string" ? address.line2 : null,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
    },
    isGift: Boolean(value.isGift),
    giftMessage: typeof value.giftMessage === "string" ? value.giftMessage : null,
  };
}

export async function saveRazorpayCheckoutSession(input: {
  razorpayOrderId: string;
  ctx: CheckoutContext;
  orderId?: string | null;
}) {
  const context = JSON.parse(JSON.stringify(input.ctx)) as Prisma.InputJsonValue;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.razorpay_checkout_sessions.upsert({
    where: { razorpay_order_id: input.razorpayOrderId },
    create: {
      razorpay_order_id: input.razorpayOrderId,
      customer_id: input.ctx.checkoutUserId,
      checkout_email: input.ctx.checkoutEmail || input.ctx.address.email,
      context,
      expires_at: expiresAt,
      order_id: input.orderId ?? null,
    },
    update: {
      customer_id: input.ctx.checkoutUserId,
      checkout_email: input.ctx.checkoutEmail || input.ctx.address.email,
      context,
      expires_at: expiresAt,
      order_id: input.orderId ?? undefined,
      updated_at: new Date(),
    },
  });
}

export async function loadRazorpayCheckoutSession(
  razorpayOrderId: string
): Promise<CheckoutContext | null> {
  if (!razorpayOrderId) return null;
  const row = await prisma.razorpay_checkout_sessions.findUnique({
    where: { razorpay_order_id: razorpayOrderId },
    select: { context: true },
  });
  if (!row) return null;
  return parseCheckoutContext(row.context);
}

export async function markRazorpayCheckoutSessionOrder(input: {
  razorpayOrderId: string;
  orderId: string;
}) {
  await prisma.razorpay_checkout_sessions.updateMany({
    where: { razorpay_order_id: input.razorpayOrderId },
    data: { order_id: input.orderId, updated_at: new Date() },
  });
}
