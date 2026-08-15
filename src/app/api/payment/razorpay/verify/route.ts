import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { createOrderAccessToken } from "@/lib/security/orderAccess";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { buildCheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { buildCheckoutContextFromOrder } from "@/lib/orders/buildCheckoutContextFromOrder";
import { orderEligibleForPaymentRetry } from "@/lib/orders/paymentRetry";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { unsealCheckoutContext } from "@/lib/checkout/checkoutSeal";
import { loadRazorpayCheckoutSession } from "@/lib/checkout/razorpayCheckoutSessions";
import { getRazorpayClient, verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { runPostOrderFulfillment } from "@/lib/orders/runPostOrderFulfillment";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { buildPurchaseAnalyticsPayload } from "@/lib/analytics/buildPurchaseAnalytics";
import {
  fulfillCapturedRazorpayPayment,
  RazorpayFulfillHttpError,
} from "@/lib/orders/fulfillCapturedRazorpayPayment";

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

      const retryOrderId = cleanText(body.retryOrderId, 64);
      if (retryOrderId && isUuid(retryOrderId)) {
        const retryOrder = await prisma.orders.findUnique({
          where: { id: retryOrderId },
          select: {
            id: true,
            customer_id: true,
            status: true,
            payment_status: true,
            payment_retry_attempts: true,
            razorpay_checkout_order_id: true,
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
        if (
          retryOrder.payment_status !== "SUCCEEDED" &&
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
      }

      const checkoutSeal = cleanText(body.checkoutSeal, 32_000);
      let ctx =
        checkoutSeal.length > 0
          ? unsealCheckoutContext(checkoutSeal, razorpayOrderId)
          : null;
      if (!ctx) {
        ctx = await loadRazorpayCheckoutSession(razorpayOrderId);
      }
      if (!ctx && retryOrderId && isUuid(retryOrderId)) {
        ctx = await buildCheckoutContextFromOrder(retryOrderId);
      }
      if (!ctx) {
        ctx = await buildCheckoutContext({ body, session });
      }

      const fulfilled = await fulfillCapturedRazorpayPayment({
        ctx,
        razorpayOrderId,
        razorpayPaymentId,
        paymentAmountPaise: Number(payment.amount),
      });

      const accessTokenOut = createOrderAccessToken(fulfilled.orderId);
      const productIds = ctx.lineItems.map((li) => li.productId);

      if (!fulfilled.alreadyProcessed) {
        after(async () => {
          try {
            await runPostOrderFulfillment({
              orderId: fulfilled.orderId,
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
              orderId: fulfilled.orderId,
              checkoutFormEmail: ctx.address.email,
              error: fulfillmentErr,
            });
          }
        });
      }

      return NextResponse.json(
        {
          ok: true,
          orderId: fulfilled.orderId,
          orderNumber: fulfilled.orderNumber,
          accessToken: accessTokenOut,
          checkoutLinkedAs: ctx.checkoutLinkedAs,
          passwordSetupIncluded: Boolean(ctx.newAccountPasswordSetup),
          newAccountCreated: ctx.checkoutLinkedAs === "new_customer",
          alreadyProcessed: fulfilled.alreadyProcessed,
          retried: fulfilled.retried,
          purchase: buildPurchaseAnalyticsPayload({
            transactionId: fulfilled.orderNumber || fulfilled.orderId,
            value: ctx.total,
            currency: "INR",
            shipping: ctx.shipping,
            coupon: ctx.coupon?.code ?? null,
            lineItems: ctx.lineItems,
          }),
        },
        { status: fulfilled.alreadyProcessed || fulfilled.retried ? 200 : 201 }
      );
    } catch (e: any) {
      if (e instanceof RazorpayFulfillHttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error("[razorpay/verify] order creation failed", {
        message: e?.message,
        code: e?.code,
        meta: e?.meta,
      });
      const message = String(e?.message ?? "Could not verify payment");
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
    { name: "POST /api/payment/razorpay/verify", timeoutMs: 25_000 }
  );
}
