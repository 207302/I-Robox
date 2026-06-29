import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteOrderById } from "@/lib/admin/deleteOrder";
import { restoreSoldInventoryForOrder, orderPaymentCountedAsSold } from "@/lib/inventory/orderInventoryRestore";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
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
  isUuid,
  readJsonBody,
} from "@/lib/validation/input";
import { notifyCustomerOrderOrShipmentUpdate } from "@/lib/orders/customerOrderNotifications";
import { maybeSendReviewRequestEmail } from "@/lib/orders/maybeSendReviewRequestEmail";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import {
  sendManualFullRefundEmail,
  sendManualPartialRefundEmail,
} from "@/lib/email/refundConfirmationEmail";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { compactOrderId, formatOrderReference } from "@/lib/orders/orderNumber";
import { adminProductImageSelect, firstProductImageUrl } from "@/lib/admin/productThumbnail";
import {
  applyShipmozoWebhookUpdate,
  mapTrackingStatusToShipmentEnum,
  resolveOrderTrackingStatus,
  syncShipmozoAwbForOrder,
  syncShipmozoTrackingForOrder,
} from "@/lib/shipping/shipmozoTracking";
import { isShipmozoTrackingStatus } from "@/lib/shipping/shipmozoTrackingConstants";

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

    await syncShipmozoAwbForOrder(id, { force: true });
    await syncShipmozoTrackingForOrder(id, { force: true });

    const order = await prisma.orders.findUnique({
      where: { id },
      select: {
        id: true,
        order_number: true,
        awb_number: true,
        carrier: true,
        shipment_status: true,
        shipment_updated_at: true,
        status: true,
        payment_status: true,
        payment_provider: true,
        external_payment_id: true,
        refund_transaction_id: true,
        refunded_amount: true,
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
            product_id: true,
            product_name: true,
            quantity: true,
            unit_price: true,
            subtotal_amount: true,
            products: {
              select: {
                slug: true,
                product_images: adminProductImageSelect,
              },
            },
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

    const trackingStatus = resolveOrderTrackingStatus({
      shipment_status: order.shipment_status,
      awb_number: order.awb_number,
      legacy_shipment_status: order.shipments?.status ? String(order.shipments.status) : null,
      legacy_tracking_number: order.shipments?.tracking_number ?? null,
    });
    const trackingNumber =
      order.awb_number?.trim() || order.shipments?.tracking_number?.trim() || "";
    const trackingCarrier = order.carrier?.trim() || order.shipments?.carrier?.trim() || "";
  
    return NextResponse.json(
      {
        id: order.id,
        orderId: compactOrderId(order.order_number),
        orderNumber: order.order_number,
        status: String(order.status),
        paymentStatus,
        paymentMethod: formatPaymentMethod(order.payment_provider, paymentStatus),
        razorpayPaymentId:
          (order.payment_provider ?? "").toLowerCase().includes("razorpay") &&
          order.external_payment_id?.trim()
            ? order.external_payment_id.trim()
            : null,
        refundTransactionId: order.refund_transaction_id?.trim() || null,
        refundedAmount:
          typeof order.refunded_amount === "number" ? order.refunded_amount : null,
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
              carrier: trackingCarrier,
              tracking_number: trackingNumber,
              trackingStatus,
              shipment_updated_at: order.shipment_updated_at?.toISOString() ?? null,
              shipmozo: shipmozoFromMeta,
            }
          : {
              id: null,
              carrier: trackingCarrier,
              tracking_number: trackingNumber,
              trackingStatus,
              shipment_updated_at: order.shipment_updated_at?.toISOString() ?? null,
              shipmozo: null,
            },
        items: order.order_items.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          product_slug: it.products?.slug ?? null,
          product_image_url: it.products ? firstProductImageUrl(it.products) : null,
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
        id: true,
        order_number: true,
        status: true,
        payment_status: true,
        refund_transaction_id: true,
        refunded_amount: true,
        customers: { select: { email: true } },
        shipments: { select: { status: true, carrier: true, tracking_number: true } },
      },
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const prevStatus = String(before.status);
    const prevPaymentStatus = String(before.payment_status);
    const paymentSucceeded = orderPaymentCountedAsSold(prevPaymentStatus);
    const prevShip = before.shipments
      ? {
          status: String(before.shipments.status),
          carrier: before.shipments.carrier,
          tracking_number: before.shipments.tracking_number,
        }
      : null;
  
    let restoredProductIds: string[] = [];
    let skipShipmentNotify = false;
    let nextOrderStatusForNotify = prevStatus;
    let emailError: string | null = null;
    const refundEmailErrorMessage =
      "Email failed to send — refund status was saved. Please notify the customer manually.";

    if (status === "PARTIALLY_REFUNDED") {
      if (prevPaymentStatus === "REFUNDED") {
        return NextResponse.json(
          { error: "Cannot downgrade a fully refunded order to partial refund" },
          { status: 400 }
        );
      }
      if (prevPaymentStatus !== "PARTIALLY_REFUNDED") {
        await prisma.orders.update({
          where: { id },
          data: { payment_status: "PARTIALLY_REFUNDED" },
        });
        skipShipmentNotify = true;
        const emailTo = displayEmailForCustomer(before.customers?.email ?? null);
        if (emailTo && !isSyntheticPhoneSignupEmail(emailTo)) {
          try {
            const emailResult = await sendManualPartialRefundEmail({
              to: emailTo,
              orderRef: formatOrderReference(before),
              refundTransactionId: before.refund_transaction_id,
              refundedAmountPaise: before.refunded_amount,
            });
            if (!emailResult.ok) {
              emailError = refundEmailErrorMessage;
            }
          } catch (err) {
            console.error("[admin orders PUT] partial refund email failed", err);
            emailError = refundEmailErrorMessage;
          }
        }
      }
    } else if (
      status === "REFUNDED" &&
      (prevStatus !== "REFUNDED" || prevPaymentStatus === "PARTIALLY_REFUNDED")
    ) {
      const shouldRestoreInventory =
        paymentSucceeded || prevPaymentStatus === "PARTIALLY_REFUNDED";
      const restoreResult = await prisma.$transaction(async (tx) => {
        const restore = await restoreSoldInventoryForOrder(tx, id, shouldRestoreInventory);
        if (!restore.ok) return restore;

        await tx.orders.update({
          where: { id },
          data: {
            status: "REFUNDED",
            ...(paymentSucceeded || prevPaymentStatus === "PARTIALLY_REFUNDED"
              ? { payment_status: "REFUNDED" }
              : {}),
          },
        });
        return restore;
      }, PRISMA_TRANSACTION_OPTIONS);

      if (!restoreResult.ok) {
        return NextResponse.json({ error: restoreResult.error }, { status: 409 });
      }
      restoredProductIds = restoreResult.productIds;
      nextOrderStatusForNotify = "REFUNDED";
      skipShipmentNotify = true;
      // Skip if webhook or a prior manual action already set payment_status to REFUNDED (avoids duplicate email).
      if (prevPaymentStatus !== "REFUNDED") {
        const emailTo = displayEmailForCustomer(before.customers?.email ?? null);
        if (emailTo && !isSyntheticPhoneSignupEmail(emailTo)) {
          try {
            const emailResult = await sendManualFullRefundEmail({
              to: emailTo,
              orderRef: formatOrderReference(before),
              refundTransactionId: before.refund_transaction_id,
              refundedAmountPaise: before.refunded_amount,
            });
            if (!emailResult.ok) {
              emailError = refundEmailErrorMessage;
            }
          } catch (err) {
            console.error("[admin orders PUT] full refund email failed", err);
            emailError = refundEmailErrorMessage;
          }
        }
      }
    } else {
      await prisma.orders.update({ where: { id }, data: { status: status as any } });
      nextOrderStatusForNotify = status;
    }

    if (restoredProductIds.length > 0) {
      after(async () => {
        try {
          await syncLowStockAlertsByProductIds(restoredProductIds);
          for (const productId of restoredProductIds) {
            revalidateInventoryCatalog({ productId });
          }
        } catch (err) {
          console.error("[admin orders PUT] inventory revalidate failed", err);
        }
      });
    }
  
    let nextShip = prevShip;
    const shipment = body.shipment;
    if (shipment && typeof shipment === "object" && !Array.isArray(shipment)) {
      const s = shipment as Record<string, unknown>;
      const carrierRaw = typeof s.carrier === "string" ? s.carrier : null;
      const trackingRaw = typeof s.tracking_number === "string" ? s.tracking_number : null;
      const trackingStatusRaw =
        typeof s.trackingStatus === "string"
          ? cleanText(s.trackingStatus, 40)
          : typeof s.tracking_status === "string"
            ? cleanText(s.tracking_status, 40)
            : null;
      const carrier = carrierRaw !== null ? cleanText(carrierRaw, 120) : null;
      const tracking_number = trackingRaw !== null ? cleanText(trackingRaw, 255) : null;
      if (trackingStatusRaw && !isShipmozoTrackingStatus(trackingStatusRaw)) {
        return NextResponse.json({ error: "Invalid shipment status" }, { status: 400 });
      }
      if ((carrier && hasSuspiciousInput(carrier)) || (tracking_number && hasSuspiciousInput(tracking_number))) {
        return NextResponse.json({ error: "Invalid shipment fields" }, { status: 400 });
      }

      if (trackingStatusRaw) {
        const trackingUpdate = await applyShipmozoWebhookUpdate({
          order_id: id,
          status: trackingStatusRaw,
          awb: tracking_number ?? undefined,
          carrier: carrier ?? undefined,
        });
        if (!trackingUpdate.ok) {
          return NextResponse.json(
            { error: trackingUpdate.error },
            { status: trackingUpdate.status ?? 400 }
          );
        }
        skipShipmentNotify = true;
      } else if (carrier !== null || tracking_number !== null) {
        const orderRow = await prisma.orders.findUnique({
          where: { id },
          select: {
            shipment_status: true,
            awb_number: true,
            shipments: { select: { status: true, tracking_number: true } },
          },
        });
        const trackingStep = resolveOrderTrackingStatus({
          shipment_status: orderRow?.shipment_status,
          awb_number: orderRow?.awb_number,
          legacy_shipment_status: orderRow?.shipments?.status
            ? String(orderRow.shipments.status)
            : null,
          legacy_tracking_number: orderRow?.shipments?.tracking_number,
        });
        const legacyStatus = mapTrackingStatusToShipmentEnum(trackingStep);

        await prisma.$transaction(async (tx) => {
          await tx.shipments.upsert({
            where: { order_id: id },
            update: {
              ...(carrier !== null ? { carrier } : {}),
              ...(tracking_number !== null ? { tracking_number } : {}),
            },
            create: {
              order_id: id,
              status: legacyStatus as any,
              carrier,
              tracking_number,
            },
          });
          if (tracking_number !== null || carrier !== null) {
            await tx.orders.update({
              where: { id },
              data: {
                ...(tracking_number !== null ? { awb_number: tracking_number } : {}),
                ...(carrier !== null ? { carrier } : {}),
              },
            });
          }
        });
      }

      const updated = await prisma.shipments.findUnique({
        where: { order_id: id },
        select: { status: true, carrier: true, tracking_number: true },
      });
      nextShip = updated
        ? {
            status: String(updated.status),
            carrier: updated.carrier,
            tracking_number: updated.tracking_number,
          }
        : null;
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
    if (emailTo && !isSyntheticPhoneSignupEmail(emailTo) && !skipShipmentNotify) {
      try {
        await notifyCustomerOrderOrShipmentUpdate({
          to: displayEmailForCustomer(emailTo) ?? emailTo,
          orderId: id,
          previousOrderStatus: prevStatus,
          nextOrderStatus: nextOrderStatusForNotify,
          previousShipment: prevShip,
          nextShipment: nextShip,
        });
      } catch (err) {
        console.error("[admin orders PUT] customer notify email failed", err);
      }
    }

    if (!skipShipmentNotify) {
      try {
        await maybeSendReviewRequestEmail({
          orderId: id,
          previousOrderStatus: prevStatus,
          nextOrderStatus: nextOrderStatusForNotify,
        });
      } catch (err) {
        console.error("[admin orders PUT] review request email failed", err);
      }
    }
  
    return NextResponse.json(
      emailError ? { ok: true, emailError } : { ok: true },
      { status: emailError ? 207 : 200 }
    );
  
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

