import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { verifyRazorpayWebhookSignature, getRazorpayClient } from "@/lib/payments/razorpay";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { releaseFlashSaleClaimForOrder } from "@/lib/flashSale/claims";
import { loadRazorpayCheckoutSession } from "@/lib/checkout/razorpayCheckoutSessions";
import { runPostOrderFulfillment } from "@/lib/orders/runPostOrderFulfillment";
import {
  fulfillCapturedRazorpayPayment,
  RazorpayFulfillHttpError,
} from "@/lib/orders/fulfillCapturedRazorpayPayment";
import { handleRazorpayPaymentLinkWebhook, markAdminPaymentLinkOrderPaid } from "@/lib/payments/razorpayPaymentLinkWebhook";

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
        notes?: Record<string, unknown>;
      };
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
      };
    };
  };
};

async function createOrderFromCapturedPayment(input: {
  paymentId: string;
  razorpayOrderId: string;
  paymentAmountPaise: number | null;
}) {
  const { paymentId, razorpayOrderId } = input;
  let amountPaise = input.paymentAmountPaise;
  if (!amountPaise || !Number.isFinite(amountPaise)) {
    const payment = await getRazorpayClient().payments.fetch(paymentId);
    amountPaise = Number(payment.amount);
    if (payment.status !== "captured" && payment.status !== "authorized") {
      return { created: false as const, reason: "not_captured" };
    }
  }

  const ctx = await loadRazorpayCheckoutSession(razorpayOrderId);
  if (!ctx) {
    const existing = await prisma.orders.findFirst({
      where: {
        OR: [
          { external_payment_id: paymentId, payment_provider: "razorpay" },
          { razorpay_checkout_order_id: razorpayOrderId },
        ],
      },
      select: { id: true, payment_status: true },
    });
    if (existing && existing.payment_status !== "SUCCEEDED") {
      await prisma.orders.update({
        where: { id: existing.id },
        data: {
          payment_status: "SUCCEEDED",
          external_payment_id: paymentId,
          payment_provider: "razorpay",
        },
      });
      return { created: false as const, reason: "upgraded_without_context", orderId: existing.id };
    }
    if (existing) {
      return { created: false as const, reason: "already_exists", orderId: existing.id };
    }
    console.error("[razorpay/webhook] captured payment has no checkout session; cannot create order", {
      paymentId,
      razorpayOrderId,
    });
    return { created: false as const, reason: "missing_session" };
  }

  const fulfilled = await fulfillCapturedRazorpayPayment({
    ctx,
    razorpayOrderId,
    razorpayPaymentId: paymentId,
    paymentAmountPaise: amountPaise,
  });

  if (!fulfilled.alreadyProcessed) {
    const productIds = ctx.lineItems.map((li) => li.productId);
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
            ipAddress: null,
            userAgent: "razorpay-webhook",
            action: "PAYMENT_CONFIRMED_WEBHOOK",
            newValues: { provider: "razorpay", paymentId, razorpayOrderId },
          },
        });
      } catch (fulfillmentErr) {
        console.error("[razorpay/webhook] post-order fulfillment failed", {
          orderId: fulfilled.orderId,
          paymentId,
          error: fulfillmentErr,
        });
      }
    });
  }

  return {
    created: !fulfilled.alreadyProcessed,
    reason: fulfilled.alreadyProcessed ? "already_exists" : "created",
    orderId: fulfilled.orderId,
  };
}

export async function POST(req: NextRequest) {
  return runApiRoute(
    async () => {
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await req.text();
  
    if (!signature || !verifyRazorpayWebhookSignature({ rawBody, signature })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  
    let event: RazorpayWebhookEvent;
    try {
      event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
  
    const eventName = String(event.event ?? "").trim();
    if (eventName.startsWith("payment_link.")) {
      await handleRazorpayPaymentLinkWebhook(rawBody);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    let paymentId = String(event.payload?.payment?.entity?.id ?? "").trim();
    const razorpayOrderId = String(
      event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id ?? ""
    ).trim();
    const paymentStatus = String(event.payload?.payment?.entity?.status ?? "").trim();
    let paymentAmount = Number(event.payload?.payment?.entity?.amount ?? 0);

    if (eventName === "order.paid" && razorpayOrderId && !paymentId) {
      try {
        const listed = await getRazorpayClient().orders.fetchPayments(razorpayOrderId);
        const items = Array.isArray((listed as { items?: unknown[] }).items)
          ? ((listed as { items: Array<{ id?: string; status?: string; amount?: number }> }).items)
          : [];
        const captured = items.find((p) => p.status === "captured" || p.status === "authorized");
        if (captured?.id) {
          paymentId = String(captured.id);
          paymentAmount = Number(captured.amount ?? 0);
        }
      } catch (err) {
        console.error("[razorpay/webhook] failed to fetch payments for order.paid", {
          razorpayOrderId,
          err,
        });
      }
    }
  
    if ((eventName === "payment.captured" || eventName === "order.paid") && paymentId && razorpayOrderId) {
      try {
        const result = await createOrderFromCapturedPayment({
          paymentId,
          razorpayOrderId,
          paymentAmountPaise: Number.isFinite(paymentAmount) && paymentAmount > 0 ? paymentAmount : null,
        });
        if (result.reason === "missing_session") {
          const notesOrderId = String(event.payload?.payment?.entity?.notes?.order_id ?? "").trim();
          if (notesOrderId) {
            await markAdminPaymentLinkOrderPaid({ orderId: notesOrderId, paymentId });
          } else {
            console.error("[razorpay/webhook] captured payment has no checkout session", {
              paymentId,
              razorpayOrderId,
            });
          }
        } else if (result.orderId) {
          await writeAuditLog({
            entityType: "ORDER",
            entityId: result.orderId,
            action: "PAYMENT_CONFIRMED_WEBHOOK",
            newValues: {
              event: eventName,
              paymentStatus,
              provider: "razorpay",
              created: result.created,
              reason: result.reason,
            },
          });
        }
      } catch (err) {
        if (err instanceof RazorpayFulfillHttpError && (err.status === 409 || err.status === 400)) {
          console.error("[razorpay/webhook] captured payment could not become an order", {
            paymentId,
            razorpayOrderId,
            message: err.message,
            status: err.status,
          });
          return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
        }
        console.error("[razorpay/webhook] failed to create order from captured payment", {
          paymentId,
          razorpayOrderId,
          err,
        });
        return NextResponse.json({ error: "Order create failed" }, { status: 500 });
      }
    } else if (eventName === "payment.captured" && paymentId) {
      const notesOrderId = String(event.payload?.payment?.entity?.notes?.order_id ?? "").trim();
      if (notesOrderId) {
        await markAdminPaymentLinkOrderPaid({ orderId: notesOrderId, paymentId });
      }
    } else if (eventName === "payment.failed" && (paymentId || razorpayOrderId)) {
      let order =
        paymentId
          ? await prisma.orders.findFirst({
              where: { external_payment_id: paymentId, payment_provider: "razorpay" },
              select: { id: true, payment_status: true, status: true },
            })
          : null;

      if (!order && razorpayOrderId) {
        order = await prisma.orders.findFirst({
          where: { razorpay_checkout_order_id: razorpayOrderId },
          select: { id: true, payment_status: true, status: true },
        });
      }

      // If already succeeded, do not move it backwards.
      if (order && order.payment_status !== "SUCCEEDED") {
        const failedOrder = order;
        if (failedOrder.status !== "PAYMENT_FAILED" || failedOrder.payment_status !== "FAILED") {
          await prisma.$transaction(async (tx) => {
            await tx.orders.update({
              where: { id: failedOrder.id },
              data: { payment_status: "FAILED", status: "PAYMENT_FAILED" },
            });
            await releaseFlashSaleClaimForOrder(failedOrder.id, tx);
          });
        }
        await writeAuditLog({
          entityType: "ORDER",
          entityId: failedOrder.id,
          action: "PAYMENT_FAILED_WEBHOOK",
          newValues: { event: eventName, paymentStatus, provider: "razorpay", razorpayOrderId },
        });
      }
    }
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  },
    { name: "POST /api/payment/razorpay/webhook", timeoutMs: 25_000 }
  );
}
