import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
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
        status: true,
        customer_id: true,
        customers: { select: { email: true } },
        shipments: {
          select: { id: true, carrier: true, tracking_number: true, status: true, metadata: true },
        },
        order_items: { select: { id: true, product_name: true, quantity: true } },
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const shipmozoFromMeta = (() => {
      const m = order.shipments?.metadata;
      if (!m || typeof m !== "object" || Array.isArray(m)) return null;
      const s = (m as Record<string, unknown>).shipmozo;
      return s && typeof s === "object" ? s : null;
    })();
  
    return NextResponse.json(
      {
        id: order.id,
        status: String(order.status),
        customer: order.customers?.email ?? order.customer_id ?? null,
        shipment: order.shipments
          ? {
              id: order.shipments.id,
              carrier: order.shipments.carrier ?? "",
              tracking_number: order.shipments.tracking_number ?? "",
              status: String(order.shipments.status),
              shipmozo: shipmozoFromMeta,
            }
          : { id: null, carrier: "", tracking_number: "", status: "PENDING", shipmozo: null },
        items: order.order_items,
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
  
      const createStatus = (shipmentStatusRaw ?? "CREATED") as any;
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

