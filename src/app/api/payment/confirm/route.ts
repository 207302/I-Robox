import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { notifyCustomerOrderOrShipmentUpdate } from "@/lib/orders/customerOrderNotifications";
import { notifyStoreNewOrder } from "@/lib/orders/storeOrderNotifications";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { bookShipmentForOrder } from "@/lib/shipping";
import { ensureOrderShipmentCreated } from "@/lib/orders/ensureOrderShipment";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { clearCustomerServerCart } from "@/lib/cart/clearCustomerServerCart";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`payment_confirm:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const session = await getSession();
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
    const orderId = cleanText(body.orderId, 64);
    const accessToken = cleanText(body.accessToken, 2048);
    if (!orderId || !isUuid(orderId)) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }
  
    let result: {
      id: string;
      already: boolean;
      customerId: string | null;
      previousStatus?: string;
      previousShipment?: { status: string; carrier: string | null; tracking_number: string | null } | null;
      nextShipment?: { status: string; carrier: string | null; tracking_number: string | null };
    };
    try {
      // Confirm payment server-side: confirm order, deduct reserved stock, create shipment.
      result = await prisma.$transaction(async (tx) => {
        const order = await tx.orders.findUnique({
          where: { id: orderId },
          select: { id: true, customer_id: true, status: true, payment_status: true, coupon_id: true },
        });
        if (!order) throw new Error("NOT_FOUND");
        const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
        // Checkout always sets customer_id (including auto-created accounts). The access token from
        // the payment URL still proves the client completed checkout and may confirm without a session.
        const hasCheckoutAccess =
          Boolean(accessToken) && verifyOrderAccessToken(accessToken, orderId);
        if (!isOwner && !hasCheckoutAccess) throw new Error("FORBIDDEN");
        if (order.payment_status === "SUCCEEDED") {
          return { id: order.id, already: true, customerId: order.customer_id };
        }
  
        const previousStatus = String(order.status);
        const prevShipRow = await tx.shipments.findUnique({
          where: { order_id: orderId },
          select: { status: true, carrier: true, tracking_number: true },
        });
        const previousShipment = prevShipRow
          ? {
              status: String(prevShipRow.status),
              carrier: prevShipRow.carrier,
              tracking_number: prevShipRow.tracking_number,
            }
          : null;
  
      const reservations = await tx.inventory_reservations.findMany({
        where: { order_id: orderId, released_at: null },
        select: { id: true, product_id: true, product_variant_id: true, quantity: true },
      });
  
      for (const r of reservations) {
        await tx.inventory.updateMany({
          where: {
            product_id: r.product_id,
            product_variant_id: r.product_variant_id,
            reserved_quantity: { gte: r.quantity },
          },
          data: {
            reserved_quantity: { decrement: r.quantity },
            sold_quantity: { increment: r.quantity },
          },
        });
        await tx.inventory_reservations.update({
          where: { id: r.id },
          data: { released_at: new Date() },
        });
      }
  
      await tx.orders.update({
        where: { id: orderId },
        data: {
          payment_status: "SUCCEEDED",
          external_payment_id: `placeholder_${Date.now()}`,
        },
      });
  
      if (order.coupon_id) {
        await tx.coupon_usages.create({
          data: {
            coupon_id: order.coupon_id,
            customer_id: order.customer_id ?? null,
            order_id: orderId,
          },
        });
      }
  
        return {
          id: orderId,
          already: false,
          customerId: order.customer_id,
          previousStatus,
          previousShipment,
        };
      }, PRISMA_TRANSACTION_OPTIONS);
    } catch (e: any) {
      if (e?.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (e?.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      throw e;
    }
  
    const recipientHint = session?.email ?? null;
    const shouldNotify = !result.already;
  
    after(async () => {
      if (!shouldNotify) return;

      if (result.customerId) {
        try {
          await clearCustomerServerCart(result.customerId);
        } catch (err) {
          console.error("[payment/confirm] clear server cart failed", err);
        }
      }
  
      try {
        await ensureOrderShipmentCreated(orderId);
      } catch (err) {
        console.error("[payment/confirm] shipment row failed", err);
      }
  
      const shipRow = await prisma.shipments.findUnique({
        where: { order_id: orderId },
        select: { status: true, carrier: true, tracking_number: true },
      });
      const nextShipment = shipRow
        ? {
            status: String(shipRow.status),
            carrier: shipRow.carrier,
            tracking_number: shipRow.tracking_number,
          }
        : {
            status: "PENDING",
            carrier: null,
            tracking_number: null,
          };
  
      try {
        await writeAuditLog({
          customerId: session?.sub ?? null,
          entityType: "ORDER",
          entityId: orderId,
          action: "PAYMENT_CONFIRMED",
          newValues: { payment_status: "SUCCEEDED", status: "PENDING" },
          ipAddress: req.ip ?? null,
          userAgent: req.headers.get("user-agent"),
        });
      } catch (err) {
        console.error("[payment/confirm] audit log failed", err);
      }
  
      let recipient = recipientHint;
      if (!recipient) {
        const row = await prisma.orders.findUnique({
          where: { id: orderId },
          select: { customers: { select: { email: true } } },
        });
        recipient = row?.customers?.email ?? null;
      }

      try {
        await bookShipmentForOrder(orderId);
      } catch (delErr) {
        console.error("[payment/confirm] shipment booking failed", delErr);
      }

      try {
        await notifyStoreNewOrder(orderId);
      } catch (storeErr) {
        console.error("[payment/confirm] store order email failed", storeErr);
      }

      if (!recipient || isSyntheticPhoneSignupEmail(recipient)) return;

      try {
        await notifyCustomerOrderOrShipmentUpdate({
          to: recipient,
          orderId,
          previousOrderStatus: result.previousStatus ?? "PENDING",
          nextOrderStatus: result.previousStatus ?? "PENDING",
          previousShipment: result.previousShipment ?? null,
          nextShipment,
        });
      } catch (err) {
        console.error("[payment/confirm] customer notify email failed", err);
      }
    });
  
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  
  });}

