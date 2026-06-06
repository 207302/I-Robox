import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteOrderById } from "@/lib/admin/deleteOrder";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { ORDERS_TAG } from "@/lib/cache/tags";
import { revalidateInventoryCatalog } from "@/lib/cache/revalidate";
import {
  cleanText,
  hasSuspiciousInput,
  isAllowedOrderStatus,
  isAllowedShipmentStatus,
  isUuid,
  readJsonBody,
} from "@/lib/validation/input";
import { notifyCustomerOrderOrShipmentUpdate } from "@/lib/orders/customerOrderNotifications";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { compactOrderId } from "@/lib/orders/orderNumber";

function formatPaymentMethod(provider: string | null, paymentStatus: string): string {
  const p = (provider ?? "").trim().toLowerCase();
  if (p.includes("razorpay")) return "Razorpay";
  if (p === "placeholder") {
    return paymentStatus === "SUCCEEDED" ? "Online payment" : "Payment pending";
  }
  if (provider?.trim()) return provider.trim();
  return paymentStatus === "SUCCEEDED" ? "Paid" : "Payment pending";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = await prisma.orders.findUnique({
      where: { id },
      select: {
        id: true,
        order_number: true,
        status: true,
        payment_status: true,
        payment_provider: true,
        subtotal_amount: true,
        discount_amount: true,
        shipping_amount: true,
        total_amount: true,
        is_gift: true,
        gift_message: true,
        created_at: true,
        customer_id: true,
        customers: { select: { email: true, name: true, phone: true } },
        addresses_orders_shipping_address_idToaddresses: {
          select: {
            full_name: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
          },
        },
        shipments: {
          select: { id: true, carrier: true, tracking_number: true, status: true, metadata: true },
        },
        order_items: {
          select: {
            id: true,
            product_name: true,
            quantity: true,
            unit_price: true,
            subtotal_amount: true,
          },
        },
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ship = order.addresses_orders_shipping_address_idToaddresses;
    const paymentStatus = String(order.payment_status);
  
    const shipmozoFromMeta = (() => {
      const m = order.shipments?.metadata;
      if (!m || typeof m !== "object" || Array.isArray(m)) return null;
      const s = (m as Record<string, unknown>).shipmozo;
      return s && typeof s === "object" ? s : null;
    })();
  
    return NextResponse.json(
      {
        id: order.id,
        orderId: compactOrderId(order.order_number),
        orderNumber: order.order_number,
        status: String(order.status),
        paymentStatus,
        paymentMethod: formatPaymentMethod(order.payment_provider, paymentStatus),
        subtotalAmount: Number(order.subtotal_amount),
        discountAmount: Number(order.discount_amount),
        shippingAmount: Number(order.shipping_amount),
        totalAmount: Number(order.total_amount),
        isGift: Boolean(order.is_gift),
        giftMessage: order.gift_message ?? null,
        customer: {
          name: ship?.full_name?.trim() || order.customers?.name?.trim() || null,
          phone: ship?.phone?.trim() || order.customers?.phone?.trim() || null,
          email: order.customers?.email ?? null,
        },
        shippingAddress: ship
          ? {
              line1: ship.line1,
              line2: ship.line2,
              city: ship.city,
              state: ship.state,
              postalCode: ship.postal_code,
              country: ship.country,
            }
          : null,
        shipment: order.shipments
          ? {
              id: order.shipments.id,
              carrier: order.shipments.carrier ?? "",
              tracking_number: order.shipments.tracking_number ?? "",
              status: String(order.shipments.status),
              shipmozo: shipmozoFromMeta,
            }
          : { id: null, carrier: "", tracking_number: "", status: "PENDING", shipmozo: null },
        items: order.order_items.map((it) => ({
          id: it.id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          subtotal_amount: Number(it.subtotal_amount),
        })),
      },
      { status: 200 }
    );
  
  });}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_orders_put:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const status = typeof body.status === "string" ? cleanText(body.status, 40) : null;
    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }
    if (!isAllowedOrderStatus(status)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    }
  
    const before = await prisma.orders.findUnique({
      where: { id },
      select: {
        status: true,
        customers: { select: { email: true } },
        shipments: { select: { status: true, carrier: true, tracking_number: true } },
      },
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const prevStatus = String(before.status);
    const prevShip = before.shipments
      ? {
          status: String(before.shipments.status),
          carrier: before.shipments.carrier,
          tracking_number: before.shipments.tracking_number,
        }
      : null;
  
    await prisma.orders.update({ where: { id }, data: { status: status as any } });
  
    let nextShip = prevShip;
    const shipment = body.shipment;
    if (shipment && typeof shipment === "object" && !Array.isArray(shipment)) {
      const s = shipment as Record<string, unknown>;
      const carrierRaw = typeof s.carrier === "string" ? s.carrier : null;
      const trackingRaw = typeof s.tracking_number === "string" ? s.tracking_number : null;
      const shipmentStatusRaw = typeof s.status === "string" ? cleanText(s.status, 40) : null;
      const carrier = carrierRaw !== null ? cleanText(carrierRaw, 120) : null;
      const tracking_number = trackingRaw !== null ? cleanText(trackingRaw, 255) : null;
      if (shipmentStatusRaw && !isAllowedShipmentStatus(shipmentStatusRaw)) {
        return NextResponse.json({ error: "Invalid shipment status" }, { status: 400 });
      }
      if ((carrier && hasSuspiciousInput(carrier)) || (tracking_number && hasSuspiciousInput(tracking_number))) {
        return NextResponse.json({ error: "Invalid shipment fields" }, { status: 400 });
      }
  
      const createStatus = (shipmentStatusRaw ?? "PENDING") as any;
      const updated = await prisma.shipments.upsert({
        where: { order_id: id },
        update: {
          carrier,
          tracking_number,
          ...(shipmentStatusRaw ? { status: shipmentStatusRaw as any } : {}),
        },
        create: {
          order_id: id,
          status: createStatus,
          carrier,
          tracking_number,
        },
        select: { status: true, carrier: true, tracking_number: true },
      });
      nextShip = {
        status: String(updated.status),
        carrier: updated.carrier,
        tracking_number: updated.tracking_number,
      };
    } else {
      const srow = await prisma.shipments.findUnique({
        where: { order_id: id },
        select: { status: true, carrier: true, tracking_number: true },
      });
      nextShip = srow
        ? {
            status: String(srow.status),
            carrier: srow.carrier,
            tracking_number: srow.tracking_number,
          }
        : null;
    }
  
    const emailTo = before.customers?.email ?? null;
    if (emailTo && !isSyntheticPhoneSignupEmail(emailTo)) {
      try {
        await notifyCustomerOrderOrShipmentUpdate({
          to: emailTo,
          orderId: id,
          previousOrderStatus: prevStatus,
          nextOrderStatus: status,
          previousShipment: prevShip,
          nextShipment: nextShip,
        });
      } catch (err) {
        console.error("[admin orders PUT] customer notify email failed", err);
      }
    }
  
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_orders_del:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await deleteOrderById(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    after(async () => {
      try {
        await writeAuditLog({
          adminUserId: auth.session.sub,
          entityType: "ORDER",
          entityId: id,
          action: "ORDER_DELETED",
          ipAddress: req.ip ?? null,
          userAgent: req.headers.get("user-agent"),
        });
        await syncLowStockAlertsByProductIds(result.productIds);
        for (const productId of result.productIds) {
          revalidateInventoryCatalog({ productId });
        }
        revalidateTag(ORDERS_TAG);
      } catch (err) {
        console.error("[admin orders DELETE] background work failed", err);
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  });
}

