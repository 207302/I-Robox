import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { unsealCheckoutContext } from "@/lib/checkout/checkoutSeal";
import { createFailedOrderFromCheckoutContext } from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { recordPaymentRetryFailure } from "@/lib/orders/recordPaymentRetryFailure";
import { getPaymentRetryState } from "@/lib/orders/paymentRetry";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { writeAuditLog } from "@/lib/audit";
import { StockValidationError } from "@/lib/inventory/cartStock";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`rzp_record_fail:${req.ip ?? "unknown"}`, 3);
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
    const checkoutSeal = cleanText(body.checkoutSeal, 32_000);
    const razorpayOrderId = cleanText(body.razorpayOrderId, 120);

    if (orderId && isUuid(orderId)) {
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        select: { id: true, customer_id: true, payment_retry_attempts: true },
      });
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
      const hasCheckoutAccess = Boolean(accessToken) && verifyOrderAccessToken(accessToken, orderId);
      if (!isOwner && !hasCheckoutAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await recordPaymentRetryFailure(orderId);
      if (!result.ok) {
        return NextResponse.json({ error: "Order is not eligible for retry tracking" }, { status: 400 });
      }

      await writeAuditLog({
        customerId: session?.sub ?? order.customer_id ?? null,
        entityType: "ORDER",
        entityId: orderId,
        action: "PAYMENT_RETRY_FAILED",
        newValues: { payment_retry_attempts: result.attempts, exhausted: result.exhausted },
        ipAddress: req.ip ?? null,
        userAgent: req.headers.get("user-agent"),
      });

      return NextResponse.json({
        ok: true,
        orderId,
        attempts: result.attempts,
        retry: result.retry,
        exhausted: result.exhausted,
      });
    }

    if (!checkoutSeal || !razorpayOrderId) {
      return NextResponse.json({ error: "checkoutSeal and razorpayOrderId are required" }, { status: 400 });
    }

    const ctx = unsealCheckoutContext(checkoutSeal, razorpayOrderId);
    if (!ctx) {
      return NextResponse.json({ error: "Checkout session expired. Please try again from cart." }, { status: 400 });
    }

    try {
      const created = await createFailedOrderFromCheckoutContext(ctx, razorpayOrderId);

      await writeAuditLog({
        customerId: session?.sub ?? created.customer_id ?? null,
        entityType: "ORDER",
        entityId: created.id,
        action: "PAYMENT_FAILED",
        newValues: { status: "PAYMENT_FAILED", razorpayOrderId },
        ipAddress: req.ip ?? null,
        userAgent: req.headers.get("user-agent"),
      });

      return NextResponse.json({
        ok: true,
        orderId: created.id,
        orderNumber: created.order_number,
        attempts: 0,
        retry: getPaymentRetryState(0),
        exhausted: false,
      });
    } catch (err) {
      if (err instanceof StockValidationError || String(err).includes("OUT_OF_STOCK")) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "One or more items are out of stock" },
          { status: 409 }
        );
      }
      throw err;
    }
  });
}
