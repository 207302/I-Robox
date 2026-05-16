import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { runApiRoute } from "@/lib/api/runApiRoute";

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
    const paymentStatus = String(event.payload?.payment?.entity?.status ?? "").trim();
  
    // We create orders only after successful verification in checkout flow.
    // Webhooks are used for reconciliation and future observability.
    if (eventName === "payment.captured" && paymentId) {
      const order = await prisma.orders.findFirst({
        where: { external_payment_id: paymentId, payment_provider: "razorpay" },
        select: { id: true, payment_status: true, status: true },
      });
      if (order && (order.payment_status !== "SUCCEEDED" || order.status !== "CONFIRMED")) {
        await prisma.orders.update({
          where: { id: order.id },
          data: { payment_status: "SUCCEEDED", status: "CONFIRMED" },
        });
        await writeAuditLog({
          entityType: "ORDER",
          entityId: order.id,
          action: "PAYMENT_CONFIRMED_WEBHOOK",
          newValues: { event: eventName, paymentStatus, provider: "razorpay" },
        });
      }
    } else if (eventName === "payment.failed" && paymentId) {
      const order = await prisma.orders.findFirst({
        where: { external_payment_id: paymentId, payment_provider: "razorpay" },
        select: { id: true, payment_status: true, status: true },
      });
      // If already succeeded, do not move it backwards.
      if (order && order.payment_status !== "SUCCEEDED") {
        await prisma.orders.update({
          where: { id: order.id },
          data: { payment_status: "FAILED", status: "PAYMENT_FAILED" },
        });
        await writeAuditLog({
          entityType: "ORDER",
          entityId: order.id,
          action: "PAYMENT_FAILED_WEBHOOK",
          newValues: { event: eventName, paymentStatus, provider: "razorpay" },
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
