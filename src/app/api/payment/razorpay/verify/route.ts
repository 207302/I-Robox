import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { createOrderAccessToken } from "@/lib/security/orderAccess";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { buildCheckoutContext, type CheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { buildCheckoutContextFromOrder } from "@/lib/orders/buildCheckoutContextFromOrder";
import { confirmReservedInventoryAsSold } from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { orderEligibleForPaymentRetry } from "@/lib/orders/paymentRetry";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { unsealCheckoutContext } from "@/lib/checkout/checkoutSeal";
import { getRazorpayClient, verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { runPostOrderFulfillment } from "@/lib/orders/runPostOrderFulfillment";
import { allocateNextOrderNumber } from "@/lib/orders/orderNumber";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { assertCartItemsInStock, StockValidationError } from "@/lib/inventory/cartStock";

const REFUND_ERROR_MAX = 2000;
const OUT_OF_STOCK_PREFIX = "OUT_OF_STOCK:";

async function recordStockFailedPaymentAttempt(
  ctx: CheckoutContext,
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
    await prisma.$transaction(async (tx) => {
      const existing = await tx.orders.findFirst({
        where: { external_payment_id: paymentId, payment_provider: "razorpay" },
        select: { id: true },
      });
      if (existing) {
        await tx.orders.update({
          where: { id: existing.id },
          data: {
            refund_error: refundNote,
            ...(refundId ? { refund_transaction_id: refundId } : {}),
          },
        });
        return;
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
      await tx.orders.create({
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
          refund_transaction_id: refundId,
          refunded_amount: refundId ? Math.round(ctx.total * 100) : null,
          refund_error: refundNote,
          is_gift: ctx.isGift,
          gift_message: ctx.giftMessage,
        },
      });
    }, PRISMA_TRANSACTION_OPTIONS);
  } catch (err) {
    console.error("[razorpay/verify] failed to record stock-failed payment attempt", {
      paymentId,
      refundId,
      err,
    });
  }
}

export async function POST(req: NextRequest) {
  return runApiRoute(
    async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`rzp_verify:${req.ip ?? "unknown"}`, 2);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body as Record<string, unknown>;
  
    const razorpayOrderId = cleanText(body.razorpayOrderId, 120);
    const razorpayPaymentId = cleanText(body.razorpayPaymentId, 120);
    const razorpaySignature = cleanText(body.razorpaySignature, 255);
  
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Payment verification data is incomplete" }, { status: 400 });
    }
  
    const validSig = verifyRazorpayPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    if (!validSig) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }
  
    const session = await getSession();
    try {
      const razorpay = getRazorpayClient();
      const payment = await razorpay.payments.fetch(razorpayPaymentId);
      if (payment.order_id !== razorpayOrderId) {
        return NextResponse.json({ error: "Payment/order mismatch" }, { status: 400 });
      }
      if (payment.status !== "captured" && payment.status !== "authorized") {
        return NextResponse.json({ error: "Payment is not successful" }, { status: 400 });
      }
  
      const existing = await prisma.orders.findFirst({
        where: { external_payment_id: razorpayPaymentId, payment_provider: "razorpay" },
        select: { id: true },
      });
      if (existing) {
        const accessToken = createOrderAccessToken(existing.id);
        return NextResponse.json(
          { ok: true, orderId: existing.id, accessToken, alreadyProcessed: true },
          { status: 200 }
        );
      }

      const retryOrderId = cleanText(body.retryOrderId, 64);
      if (retryOrderId && isUuid(retryOrderId)) {
        const retryOrder = await prisma.orders.findUnique({
          where: { id: retryOrderId },
          select: {
            id: true,
            customer_id: true,
            order_number: true,
            status: true,
            payment_status: true,
            payment_retry_attempts: true,
            total_amount: true,
            razorpay_checkout_order_id: true,
            coupon_id: true,
          },
        });
        if (!retryOrder) {
          return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        const isOwner = Boolean(
          session?.sub && retryOrder.customer_id && retryOrder.customer_id === session.sub
        );
        const accessToken = cleanText(body.accessToken, 2048);
        const hasCheckoutAccess =
          Boolean(accessToken) && verifyOrderAccessToken(accessToken, retryOrderId);
        if (!isOwner && !hasCheckoutAccess) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (retryOrder.payment_status === "SUCCEEDED") {
          const token = createOrderAccessToken(retryOrder.id);
          return NextResponse.json({
            ok: true,
            orderId: retryOrder.id,
            accessToken: token,
            alreadyProcessed: true,
          });
        }
        if (
          !orderEligibleForPaymentRetry({
            status: String(retryOrder.status),
            paymentStatus: String(retryOrder.payment_status),
            paymentRetryAttempts: retryOrder.payment_retry_attempts,
          })
        ) {
          return NextResponse.json({ error: "Order is not eligible for payment retry" }, { status: 400 });
        }
        if (retryOrder.razorpay_checkout_order_id !== razorpayOrderId) {
          return NextResponse.json({ error: "Payment session mismatch" }, { status: 400 });
        }
        const expectedRetryPaise = Math.round(Number(retryOrder.total_amount) * 100);
        if (Number(payment.amount) !== expectedRetryPaise) {
          return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
        }

        const retryCtx = await buildCheckoutContextFromOrder(retryOrderId);
        if (!retryCtx) {
          return NextResponse.json({ error: "Order details are incomplete" }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
          await confirmReservedInventoryAsSold(retryOrderId, tx);
          await tx.orders.update({
            where: { id: retryOrderId },
            data: {
              payment_status: "SUCCEEDED",
              status: "CONFIRMED",
              external_payment_id: razorpayPaymentId,
              payment_provider: "razorpay",
            },
          });
          if (retryOrder.coupon_id) {
            const usageCount = await tx.coupon_usages.count({
              where: { order_id: retryOrderId, coupon_id: retryOrder.coupon_id },
            });
            if (usageCount === 0) {
              await tx.coupon_usages.create({
                data: {
                  coupon_id: retryOrder.coupon_id,
                  customer_id: retryOrder.customer_id,
                  order_id: retryOrderId,
                },
              });
            }
          }
        }, PRISMA_TRANSACTION_OPTIONS);

        const accessTokenOut = createOrderAccessToken(retryOrderId);
        const productIds = retryCtx.lineItems.map((li) => li.productId);

        after(async () => {
          try {
            await runPostOrderFulfillment({
              orderId: retryOrderId,
              productIds,
              checkoutFormEmail: retryCtx.address.email,
              accountEmail: retryCtx.accountEmail,
              newAccountPasswordSetup: retryCtx.newAccountPasswordSetup,
              audit: {
                customerId: retryCtx.checkoutUserId,
                ipAddress: req.ip ?? null,
                userAgent: req.headers.get("user-agent"),
              },
            });
          } catch (fulfillmentErr) {
            console.error("[razorpay/verify] retry fulfillment failed", {
              orderId: retryOrderId,
              fulfillmentErr,
            });
          }
        });

        return NextResponse.json(
          {
            ok: true,
            orderId: retryOrderId,
            orderNumber: retryOrder.order_number,
            accessToken: accessTokenOut,
            retried: true,
          },
          { status: 200 }
        );
      }
  
      const checkoutSeal = cleanText(body.checkoutSeal, 32_000);
      let ctx =
        checkoutSeal.length > 0
          ? unsealCheckoutContext(checkoutSeal, razorpayOrderId)
          : null;
      if (!ctx) {
        ctx = await buildCheckoutContext({ body, session });
      }
  
      const expectedAmountPaise = Math.round(ctx.total * 100);
      if (Number(payment.amount) !== expectedAmountPaise) {
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
      }

      try {
        await assertCartItemsInStock(
          ctx.lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity })),
          new Map(ctx.lineItems.map((li) => [li.productId, li.productName]))
        );
      } catch (stockErr) {
        if (!(stockErr instanceof StockValidationError)) throw stockErr;

        let userMessage = stockErr.message;
        try {
          const refund = await razorpay.payments.refund(razorpayPaymentId, {
            amount: expectedAmountPaise,
          });
          const refundId = String((refund as { id?: string }).id ?? "").trim();
          console.info("[razorpay/verify] auto-refund after stock failure", {
            paymentId: razorpayPaymentId,
            refundId,
          });
          await recordStockFailedPaymentAttempt(ctx, razorpayPaymentId, refundId || null, stockErr.message);
          userMessage = `${stockErr.message} Your payment has been refunded automatically.`;
        } catch (refundErr) {
          console.error("[razorpay/verify] auto-refund failed after stock failure", {
            paymentId: razorpayPaymentId,
            refundErr,
          });
          await recordStockFailedPaymentAttempt(ctx, razorpayPaymentId, null, stockErr.message);
          userMessage = `${stockErr.message} We could not complete your order — please contact support for a refund.`;
        }

        return NextResponse.json({ error: userMessage }, { status: 409 });
      }

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
  
        return order;
      }, PRISMA_TRANSACTION_OPTIONS);
  
      const accessToken = createOrderAccessToken(created.id);
      const productIds = ctx.lineItems.map((li) => li.productId);
  
      after(async () => {
        try {
          await runPostOrderFulfillment({
            orderId: created.id,
            productIds,
            checkoutFormEmail: ctx.address.email,
            accountEmail: ctx.accountEmail,
            newAccountPasswordSetup: ctx.newAccountPasswordSetup,
            audit: {
              customerId: ctx.checkoutUserId,
              ipAddress: req.ip ?? null,
              userAgent: req.headers.get("user-agent"),
            },
          });
        } catch (fulfillmentErr) {
          console.error("[razorpay/verify] post-order fulfillment failed", {
            orderId: created.id,
            checkoutFormEmail: ctx.address.email,
            error: fulfillmentErr,
          });
        }
      });
  
      return NextResponse.json(
        {
          ok: true,
          orderId: created.id,
          orderNumber: created.order_number,
          accessToken,
          checkoutLinkedAs: ctx.checkoutLinkedAs,
          passwordSetupIncluded: Boolean(ctx.newAccountPasswordSetup),
          newAccountCreated: ctx.checkoutLinkedAs === "new_customer",
        },
        { status: 201 }
      );
    } catch (e: any) {
      console.error("[razorpay/verify] order creation failed", {
        message: e?.message,
        code: e?.code,
        meta: e?.meta,
      });
      if (String(e?.message ?? "").startsWith(OUT_OF_STOCK_PREFIX) || e instanceof StockValidationError) {
        const outMsg = String(e?.message ?? "");
        const stockDetail = outMsg.startsWith(OUT_OF_STOCK_PREFIX)
          ? `${outMsg.slice(OUT_OF_STOCK_PREFIX.length)} went out of stock while paying`
          : outMsg;
        return NextResponse.json(
          {
            error: e instanceof StockValidationError ? e.message : stockDetail,
          },
          { status: 409 }
        );
      }
      const msg = String(e?.message ?? "");
      if (msg.startsWith("MAX_ORDER_QTY_EXCEEDED:")) {
        const [, productName, maxRaw] = msg.split(":");
        const maxQty = Number(maxRaw);
        return NextResponse.json(
          {
            error: Number.isFinite(maxQty)
              ? `${productName || "This item"} allows max ${maxQty} per order`
              : "One or more items exceed the per-order quantity limit",
          },
          { status: 400 }
        );
      }
      const message = msg || "Could not verify payment";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
    { name: "POST /api/payment/razorpay/verify", timeoutMs: 25_000 }
  );
}
