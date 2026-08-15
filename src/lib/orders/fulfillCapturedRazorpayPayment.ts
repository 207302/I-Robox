import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { markRazorpayCheckoutSessionOrder } from "@/lib/checkout/razorpayCheckoutSessions";
import { confirmReservedInventoryAsSold } from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { allocateNextOrderNumber } from "@/lib/orders/orderNumber";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { getRazorpayClient } from "@/lib/payments/razorpay";
import { assertCartItemsInStock, StockValidationError } from "@/lib/inventory/cartStock";
import {
  claimFlashSaleForOrderInTx,
  FlashSaleClaimError,
} from "@/lib/flashSale/claims";

const REFUND_ERROR_MAX = 2000;
const OUT_OF_STOCK_PREFIX = "OUT_OF_STOCK:";

export class RazorpayFulfillHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "RazorpayFulfillHttpError";
  }
}

export type FulfilledRazorpayOrder = {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  alreadyProcessed: boolean;
  retried: boolean;
  ctx: CheckoutContext;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findExistingRazorpayOrder(input: {
  razorpayPaymentId: string;
  razorpayOrderId: string;
}) {
  const byPayment = await prisma.orders.findFirst({
    where: { external_payment_id: input.razorpayPaymentId, payment_provider: "razorpay" },
    select: {
      id: true,
      order_number: true,
      customer_id: true,
      status: true,
      payment_status: true,
      coupon_id: true,
      refund_transaction_id: true,
    },
  });
  if (byPayment) return byPayment;
  return prisma.orders.findFirst({
    where: { razorpay_checkout_order_id: input.razorpayOrderId },
    select: {
      id: true,
      order_number: true,
      customer_id: true,
      status: true,
      payment_status: true,
      coupon_id: true,
      refund_transaction_id: true,
    },
  });
}

async function recordStockFailedPaymentAttempt(
  ctx: CheckoutContext,
  razorpayOrderId: string,
  paymentId: string,
  refundId: string | null,
  stockError: string
) {
  const refundNote = [
    stockError,
    refundId ? `Auto-refund issued: ${refundId}` : "Auto-refund could not be completed",
  ]
    .join(" | ")
    .slice(0, REFUND_ERROR_MAX);

  try {
    const recordedOrderId = await prisma.$transaction(async (tx) => {
      const existing = await tx.orders.findFirst({
        where: {
          OR: [
            { external_payment_id: paymentId, payment_provider: "razorpay" },
            { razorpay_checkout_order_id: razorpayOrderId },
          ],
        },
        select: { id: true },
      });
      if (existing) {
        await tx.orders.update({
          where: { id: existing.id },
          data: {
            refund_error: refundNote,
            razorpay_checkout_order_id: razorpayOrderId,
            ...(refundId ? { refund_transaction_id: refundId } : {}),
          },
        });
        return existing.id;
      }

      const addr = await tx.addresses.create({
        data: {
          customer_id: ctx.checkoutUserId,
          full_name: ctx.address.full_name,
          phone: ctx.address.phone,
          line1: ctx.address.line1,
          line2: ctx.address.line2,
          city: ctx.address.city,
          state: ctx.address.state,
          postal_code: ctx.address.postal_code,
          country: ctx.address.country,
          is_default_billing: false,
          is_default_shipping: false,
        },
        select: { id: true },
      });

      const order_number = await allocateNextOrderNumber(tx);
      const created = await tx.orders.create({
        data: {
          order_number,
          customer_id: ctx.checkoutUserId,
          status: "PAYMENT_FAILED",
          payment_status: refundId ? "REFUNDED" : "SUCCEEDED",
          subtotal_amount: ctx.subtotal,
          discount_amount: ctx.discount,
          shipping_amount: ctx.shipping,
          tax_amount: 0,
          total_amount: ctx.total,
          currency: "INR",
          coupon_id: ctx.coupon?.id ?? null,
          shipping_address_id: addr.id,
          billing_address_id: addr.id,
          payment_provider: "razorpay",
          external_payment_id: paymentId,
          razorpay_checkout_order_id: razorpayOrderId,
          refund_transaction_id: refundId,
          refunded_amount: refundId ? Math.round(ctx.total * 100) : null,
          refund_error: refundNote,
          is_gift: ctx.isGift,
          gift_message: ctx.giftMessage,
        },
        select: { id: true },
      });
      return created.id;
    }, PRISMA_TRANSACTION_OPTIONS);
    if (recordedOrderId) {
      await markRazorpayCheckoutSessionOrder({
        razorpayOrderId,
        orderId: recordedOrderId,
      });
    }
  } catch (err) {
    console.error("[razorpay] failed to record stock-failed payment attempt", {
      paymentId,
      refundId,
      err,
    });
  }
}

async function refundCapturedPayment(input: {
  razorpayPaymentId: string;
  amountPaise: number;
}): Promise<string | null> {
  const razorpay = getRazorpayClient();
  const refund = await razorpay.payments.refund(input.razorpayPaymentId, {
    amount: input.amountPaise,
  });
  return String((refund as { id?: string }).id ?? "").trim() || null;
}

async function refundAndExplain(input: {
  ctx: CheckoutContext;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  userMessage: string;
  logLabel: string;
}): Promise<never> {
  let refundId: string | null = null;
  try {
    refundId = await refundCapturedPayment({
      razorpayPaymentId: input.razorpayPaymentId,
      amountPaise: input.amountPaise,
    });
    console.info(`[razorpay] ${input.logLabel}`, {
      paymentId: input.razorpayPaymentId,
      refundId,
    });
    await recordStockFailedPaymentAttempt(
      input.ctx,
      input.razorpayOrderId,
      input.razorpayPaymentId,
      refundId,
      input.userMessage
    );
    throw new RazorpayFulfillHttpError(
      `${input.userMessage} Your payment has been refunded automatically.`,
      409
    );
  } catch (err) {
    if (err instanceof RazorpayFulfillHttpError) throw err;
    console.error(`[razorpay] auto-refund failed after ${input.logLabel}`, {
      paymentId: input.razorpayPaymentId,
      refundErr: err,
    });
    await recordStockFailedPaymentAttempt(
      input.ctx,
      input.razorpayOrderId,
      input.razorpayPaymentId,
      null,
      input.userMessage
    );
    throw new RazorpayFulfillHttpError(
      `${input.userMessage} We could not complete your order — please contact support for a refund.`,
      409
    );
  }
}

async function upgradeExistingCapturedOrder(input: {
  existing: NonNullable<Awaited<ReturnType<typeof findExistingRazorpayOrder>>>;
  ctx: CheckoutContext;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<FulfilledRazorpayOrder> {
  const { existing, ctx, razorpayOrderId, razorpayPaymentId } = input;
  try {
    await prisma.$transaction(async (tx) => {
      await confirmReservedInventoryAsSold(existing.id, tx);
      await tx.orders.update({
        where: { id: existing.id },
        data: {
          payment_status: "SUCCEEDED",
          status: existing.status === "PAYMENT_FAILED" ? "CONFIRMED" : existing.status,
          external_payment_id: razorpayPaymentId,
          payment_provider: "razorpay",
          razorpay_checkout_order_id: razorpayOrderId,
        },
      });
      if (existing.coupon_id) {
        const usageCount = await tx.coupon_usages.count({
          where: { order_id: existing.id, coupon_id: existing.coupon_id },
        });
        if (usageCount === 0) {
          await tx.coupon_usages.create({
            data: {
              coupon_id: existing.coupon_id,
              customer_id: existing.customer_id,
              order_id: existing.id,
            },
          });
        }
      }
      if (existing.customer_id) {
        const existingClaim = await tx.flash_sale_claims.findUnique({
          where: { order_id: existing.id },
          select: { id: true },
        });
        if (!existingClaim) {
          await claimFlashSaleForOrderInTx(tx, {
            customerId: existing.customer_id,
            orderId: existing.id,
            lines: ctx.lineItems.map((li) => ({
              productId: li.productId,
              quantity: li.quantity,
            })),
          });
        }
      }
    }, PRISMA_TRANSACTION_OPTIONS);
  } catch (claimErr) {
    if (claimErr instanceof FlashSaleClaimError) {
      await refundAndExplain({
        ctx,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: Math.round(ctx.total * 100),
        userMessage: claimErr.message,
        logLabel: "auto-refund after flash claim failure (upgrade)",
      });
    }
    throw claimErr;
  }

  await markRazorpayCheckoutSessionOrder({ razorpayOrderId, orderId: existing.id });
  return {
    orderId: existing.id,
    orderNumber: existing.order_number,
    customerId: existing.customer_id,
    alreadyProcessed: false,
    retried: existing.status === "PAYMENT_FAILED",
    ctx,
  };
}

async function createNewPaidOrder(input: {
  ctx: CheckoutContext;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<FulfilledRazorpayOrder> {
  const { ctx, razorpayOrderId, razorpayPaymentId } = input;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const addr = await tx.addresses.create({
        data: {
          customer_id: ctx.checkoutUserId,
          full_name: ctx.address.full_name,
          phone: ctx.address.phone,
          line1: ctx.address.line1,
          line2: ctx.address.line2,
          city: ctx.address.city,
          state: ctx.address.state,
          postal_code: ctx.address.postal_code,
          country: ctx.address.country,
          is_default_billing: false,
          is_default_shipping: false,
        },
        select: { id: true },
      });

      const order_number = await allocateNextOrderNumber(tx);
      const order = await tx.orders.create({
        data: {
          order_number,
          customer_id: ctx.checkoutUserId,
          status: "PENDING",
          payment_status: "SUCCEEDED",
          subtotal_amount: ctx.subtotal,
          discount_amount: ctx.discount,
          shipping_amount: ctx.shipping,
          tax_amount: 0,
          total_amount: ctx.total,
          currency: "INR",
          coupon_id: ctx.coupon?.id ?? null,
          shipping_address_id: addr.id,
          billing_address_id: addr.id,
          payment_provider: "razorpay",
          external_payment_id: razorpayPaymentId,
          razorpay_checkout_order_id: razorpayOrderId,
          is_gift: ctx.isGift,
          gift_message: ctx.giftMessage,
        },
        select: { id: true, customer_id: true, order_number: true },
      });

      for (const li of ctx.lineItems) {
        const oi = await tx.order_items.create({
          data: {
            order_id: order.id,
            product_id: li.productId,
            product_variant_id: null,
            product_name: li.productName,
            sku: li.sku,
            unit_price: li.unitPrice,
            quantity: li.quantity,
            subtotal_amount: li.subtotal,
          },
          select: { id: true },
        });

        const updated = await tx.inventory.updateMany({
          where: {
            product_id: li.productId,
            product_variant_id: null,
            available_quantity: { gte: li.quantity },
          },
          data: {
            available_quantity: { decrement: li.quantity },
            sold_quantity: { increment: li.quantity },
          },
        });
        if (updated.count !== 1) {
          throw new Error(`${OUT_OF_STOCK_PREFIX}${li.productName} (${li.productId})`);
        }

        await tx.inventory_reservations.create({
          data: {
            order_id: order.id,
            order_item_id: oi.id,
            product_id: li.productId,
            product_variant_id: null,
            quantity: li.quantity,
            released_at: new Date(),
          },
        });
      }

      if (ctx.coupon?.id) {
        await tx.coupon_usages.create({
          data: {
            coupon_id: ctx.coupon.id,
            customer_id: order.customer_id ?? null,
            order_id: order.id,
          },
        });
      }

      if (!ctx.checkoutUserId) {
        throw new FlashSaleClaimError("Customer account is required");
      }
      await claimFlashSaleForOrderInTx(tx, {
        customerId: ctx.checkoutUserId,
        orderId: order.id,
        lines: ctx.lineItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
        })),
      });

      return order;
    }, PRISMA_TRANSACTION_OPTIONS);

    await markRazorpayCheckoutSessionOrder({ razorpayOrderId, orderId: created.id });
    return {
      orderId: created.id,
      orderNumber: created.order_number,
      customerId: created.customer_id,
      alreadyProcessed: false,
      retried: false,
      ctx,
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await findExistingRazorpayOrder({
        razorpayPaymentId,
        razorpayOrderId,
      });
      if (raced) {
        await markRazorpayCheckoutSessionOrder({ razorpayOrderId, orderId: raced.id });
        return {
          orderId: raced.id,
          orderNumber: raced.order_number,
          customerId: raced.customer_id,
          alreadyProcessed: true,
          retried: false,
          ctx,
        };
      }
    }
    throw err;
  }
}

/**
 * Create or upgrade the store order after Razorpay has captured payment.
 * Safe to call from both browser /verify and payment.captured webhook.
 */
export async function fulfillCapturedRazorpayPayment(input: {
  ctx: CheckoutContext;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  paymentAmountPaise: number;
}): Promise<FulfilledRazorpayOrder> {
  const { ctx, razorpayOrderId, razorpayPaymentId, paymentAmountPaise } = input;
  const expectedAmountPaise = Math.round(ctx.total * 100);
  if (paymentAmountPaise !== expectedAmountPaise) {
    throw new RazorpayFulfillHttpError("Payment amount mismatch", 400);
  }
  if (!ctx.checkoutUserId) {
    throw new RazorpayFulfillHttpError("Customer account is required", 400);
  }

  const existing = await findExistingRazorpayOrder({ razorpayPaymentId, razorpayOrderId });
  if (existing) {
    if (existing.payment_status === "SUCCEEDED" || existing.payment_status === "REFUNDED") {
      await markRazorpayCheckoutSessionOrder({ razorpayOrderId, orderId: existing.id });
      return {
        orderId: existing.id,
        orderNumber: existing.order_number,
        customerId: existing.customer_id,
        alreadyProcessed: true,
        retried: false,
        ctx,
      };
    }
    if (existing.refund_transaction_id) {
      await markRazorpayCheckoutSessionOrder({ razorpayOrderId, orderId: existing.id });
      return {
        orderId: existing.id,
        orderNumber: existing.order_number,
        customerId: existing.customer_id,
        alreadyProcessed: true,
        retried: false,
        ctx,
      };
    }
    return upgradeExistingCapturedOrder({
      existing,
      ctx,
      razorpayOrderId,
      razorpayPaymentId,
    });
  }

  try {
    await assertCartItemsInStock(
      ctx.lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity })),
      new Map(ctx.lineItems.map((li) => [li.productId, li.productName]))
    );
  } catch (stockErr) {
    if (!(stockErr instanceof StockValidationError)) throw stockErr;
    await refundAndExplain({
      ctx,
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: expectedAmountPaise,
      userMessage: stockErr.message,
      logLabel: "auto-refund after stock failure",
    });
  }

  try {
    return await createNewPaidOrder({ ctx, razorpayOrderId, razorpayPaymentId });
  } catch (e: unknown) {
    const msg = String(e instanceof Error ? e.message : "");
    if (msg.startsWith(OUT_OF_STOCK_PREFIX) || e instanceof StockValidationError) {
      const stockDetail = msg.startsWith(OUT_OF_STOCK_PREFIX)
        ? `${msg.slice(OUT_OF_STOCK_PREFIX.length)} went out of stock while paying`
        : msg;
      await refundAndExplain({
        ctx,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: expectedAmountPaise,
        userMessage: e instanceof StockValidationError ? e.message : stockDetail,
        logLabel: "auto-refund after stock failure",
      });
    }
    if (e instanceof FlashSaleClaimError) {
      await refundAndExplain({
        ctx,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: paymentAmountPaise,
        userMessage: e.message,
        logLabel: "auto-refund after flash claim failure",
      });
    }
    if (msg.startsWith("MAX_ORDER_QTY_EXCEEDED:")) {
      const [, productName, maxRaw] = msg.split(":");
      const maxQty = Number(maxRaw);
      throw new RazorpayFulfillHttpError(
        Number.isFinite(maxQty)
          ? `${productName || "This item"} allows max ${maxQty} per order`
          : "One or more items exceed the per-order quantity limit",
        400
      );
    }
    throw e;
  }
}
