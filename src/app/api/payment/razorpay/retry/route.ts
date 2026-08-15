import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildCheckoutContextFromOrder } from "@/lib/orders/buildCheckoutContextFromOrder";
import { sealCheckoutContext } from "@/lib/checkout/checkoutSeal";
import { saveRazorpayCheckoutSession } from "@/lib/checkout/razorpayCheckoutSessions";
import { orderEligibleForPaymentRetry } from "@/lib/orders/paymentRetry";
import { getRazorpayClient, razorpayPublicConfig } from "@/lib/payments/razorpay";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { assertCartItemsInStock, StockValidationError } from "@/lib/inventory/cartStock";

export async function POST(req: NextRequest) {
  return runApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimit(`rzp_retry:${req.ip ?? "unknown"}`, 2);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const session = await getSession();
      const parsed = await readJsonBody(req);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      const body = parsed.body as Record<string, unknown>;
      const orderId = cleanText(body.orderId, 64);
      const accessToken = cleanText(body.accessToken, 2048);

      if (!orderId || !isUuid(orderId)) {
        return NextResponse.json({ error: "orderId is required" }, { status: 400 });
      }

      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customer_id: true,
          status: true,
          payment_status: true,
          payment_retry_attempts: true,
          total_amount: true,
        },
      });
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
      const hasCheckoutAccess = Boolean(accessToken) && verifyOrderAccessToken(accessToken, orderId);
      if (!isOwner && !hasCheckoutAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (
        !orderEligibleForPaymentRetry({
          status: String(order.status),
          paymentStatus: String(order.payment_status),
          paymentRetryAttempts: order.payment_retry_attempts,
        })
      ) {
        return NextResponse.json(
          { error: "This order is not eligible for payment retry" },
          { status: 400 }
        );
      }

      const ctx = await buildCheckoutContextFromOrder(orderId);
      if (!ctx) {
        return NextResponse.json({ error: "Order details are incomplete" }, { status: 400 });
      }

      try {
        await assertCartItemsInStock(
          ctx.lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity })),
          new Map(ctx.lineItems.map((li) => [li.productId, li.productName]))
        );
      } catch (stockErr) {
        if (stockErr instanceof StockValidationError) {
          return NextResponse.json({ error: stockErr.message }, { status: 409 });
        }
        throw stockErr;
      }

      const razorpay = getRazorpayClient();
      const publicCfg = razorpayPublicConfig();
      const amountPaise = Math.round(Number(order.total_amount) * 100);
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `retry_${orderId.slice(0, 8)}_${Date.now()}`,
        payment_capture: true,
        notes: {
          order_id: orderId,
          retry: "1",
        },
      });

      await prisma.orders.update({
        where: { id: orderId },
        data: { razorpay_checkout_order_id: razorpayOrder.id },
      });

      const checkoutSeal = sealCheckoutContext(razorpayOrder.id, ctx);
      await saveRazorpayCheckoutSession({
        razorpayOrderId: razorpayOrder.id,
        ctx,
        orderId,
      });

      return NextResponse.json({
        ok: true,
        orderId,
        keyId: publicCfg.keyId,
        razorpayOrderId: razorpayOrder.id,
        checkoutSeal,
        amount: amountPaise,
        currency: "INR",
      });
    },
    { name: "POST /api/payment/razorpay/retry", timeoutMs: 25_000 }
  );
}
