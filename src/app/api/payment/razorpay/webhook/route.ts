import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { releaseFlashSaleClaimForOrder } from "@/lib/flashSale/claims";

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
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

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
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
    const paymentId = String(event.payload?.payment?.entity?.id ?? "").trim();
    const razorpayOrderId = String(event.payload?.payment?.entity?.order_id ?? "").trim();
    const paymentStatus = String(event.payload?.payment?.entity?.status ?? "").trim();
  
    // We create orders only after successful verification in checkout flow.
    // Webhooks are used for reconciliation and future observability.
    if (eventName === "payment.captured" && paymentId) {
      const order = await prisma.orders.findFirst({
        where: { external_payment_id: paymentId, payment_provider: "razorpay" },
        select: { id: true, payment_status: true, status: true },
      });
      if (order && order.payment_status !== "SUCCEEDED") {
        await prisma.orders.update({
          where: { id: order.id },
          data: { payment_status: "SUCCEEDED" },
        });
        await writeAuditLog({
          entityType: "ORDER",
          entityId: order.id,
          action: "PAYMENT_CONFIRMED_WEBHOOK",
          newValues: { event: eventName, paymentStatus, provider: "razorpay" },
        });
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
        if (order.status !== "PAYMENT_FAILED" || order.payment_status !== "FAILED") {
          await prisma.$transaction(async (tx) => {
            await tx.orders.update({
              where: { id: order.id },
              data: { payment_status: "FAILED", status: "PAYMENT_FAILED" },
            });
            await releaseFlashSaleClaimForOrder(order.id, tx);
          });
        }
        await writeAuditLog({
          entityType: "ORDER",
          entityId: order.id,
          action: "PAYMENT_FAILED_WEBHOOK",
          newValues: { event: eventName, paymentStatus, provider: "razorpay", razorpayOrderId },
        });
      }
    } else if (eventName === "order.paid") {
      // Optional signal for reconciliation.
      await writeAuditLog({
        entityType: "ORDER",
        action: "RAZORPAY_ORDER_PAID_WEBHOOK",
        newValues: { event: eventName },
      });
    }
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
