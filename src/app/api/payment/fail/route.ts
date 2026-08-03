import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { notifyCustomerOrderOrShipmentUpdate } from "@/lib/orders/customerOrderNotifications";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyOrderAccessToken } from "@/lib/security/orderAccess";
import { cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { releaseFlashSaleClaimForOrder } from "@/lib/flashSale/claims";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`payment_fail:${req.ip ?? "unknown"}`, 1);
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
  
    let failApplied = false;
    let releasedProductIds: string[] = [];
    let previousStatus: string | null = null;
    let previousShipment: { status: string; carrier: string | null; tracking_number: string | null } | null =
      null;
    try {
      failApplied = await prisma.$transaction(async (tx) => {
        const order = await tx.orders.findUnique({
          where: { id: orderId },
          select: { id: true, customer_id: true, payment_status: true, status: true },
        });
        if (!order) throw new Error("NOT_FOUND");
        const isOwner = Boolean(session?.sub && order.customer_id && order.customer_id === session.sub);
        const hasCheckoutAccess =
          Boolean(accessToken) && verifyOrderAccessToken(accessToken, orderId);
        if (!isOwner && !hasCheckoutAccess) throw new Error("FORBIDDEN");
        if (order.payment_status === "FAILED") return false;
        // Never move a completed/refunded payment backwards (would also free flash-sale claims).
        if (
          order.payment_status === "SUCCEEDED" ||
          order.payment_status === "REFUNDED" ||
          order.payment_status === "PARTIALLY_REFUNDED"
        ) {
          return false;
        }

        previousStatus = String(order.status);
        const prevShipRow = await tx.shipments.findUnique({
          where: { order_id: orderId },
          select: { status: true, carrier: true, tracking_number: true },
        });
        previousShipment = prevShipRow
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
        releasedProductIds = reservations.map((r) => r.product_id);
  
        for (const r of reservations) {
          await tx.inventory.updateMany({
            where: {
              product_id: r.product_id,
              product_variant_id: r.product_variant_id,
              reserved_quantity: { gte: r.quantity },
            },
            data: {
              reserved_quantity: { decrement: r.quantity },
              available_quantity: { increment: r.quantity },
            },
          });
          await tx.inventory_reservations.update({
            where: { id: r.id },
            data: { released_at: new Date() },
          });
        }
  
        await tx.orders.update({
          where: { id: orderId },
          data: { payment_status: "FAILED", status: "PAYMENT_FAILED" },
        });
        await releaseFlashSaleClaimForOrder(orderId, tx);
        return true;
      });
    } catch (e: any) {
      if (e?.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (e?.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      throw e;
    }
  
    if (failApplied) {
      await syncLowStockAlertsByProductIds(releasedProductIds).catch((err) => {
        console.error("[payment/fail] low stock alert sync failed", err);
      });
  
      await writeAuditLog({
        customerId: session?.sub ?? null,
        entityType: "ORDER",
        entityId: orderId,
        action: "PAYMENT_FAILED",
        newValues: { status: "PAYMENT_FAILED" },
        ipAddress: req.ip ?? null,
        userAgent: req.headers.get("user-agent"),
      });
    }
  
    let failRecipient: string | null = null;
    if (session?.sub) {
      const customer = await prisma.customers.findUnique({
        where: { id: session.sub },
        select: { email: true },
      });
      failRecipient = customer?.email ?? null;
    }
    if (!failRecipient) {
      const row = await prisma.orders.findUnique({
        where: { id: orderId },
        select: { customers: { select: { email: true } } },
      });
      failRecipient = row?.customers?.email ?? null;
    }
  
    if (failRecipient && failApplied && !isSyntheticPhoneSignupEmail(failRecipient) && previousStatus) {
      try {
        await notifyCustomerOrderOrShipmentUpdate({
          to: failRecipient,
          orderId,
          previousOrderStatus: previousStatus,
          nextOrderStatus: "PAYMENT_FAILED",
          previousShipment,
          nextShipment: previousShipment,
        });
      } catch (err) {
        console.error("[payment/fail] customer notify email failed", err);
      }
    }
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

