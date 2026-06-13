import { prisma } from "@/lib/prisma";
import { shipmozoOrderRef } from "@/lib/orders/orderNumber";
import { isUuid } from "@/lib/validation/input";
import { fetchShipmozoTrackOrder } from "@/lib/shipping/shipmozo";
import { sendPickupEmail } from "@/lib/email/sendPickupEmail";
import {
  SHIPMOZO_TRACKING_STEPS,
  type ShipmozoTrackingStatus,
} from "@/lib/shipping/shipmozoTrackingConstants";

export type { ShipmozoTrackingStatus } from "@/lib/shipping/shipmozoTrackingConstants";
export { SHIPMOZO_TRACKING_STEPS } from "@/lib/shipping/shipmozoTrackingConstants";

const STATUS_ALIASES: Record<string, ShipmozoTrackingStatus> = {
  ORDER_PLACED: "ORDER_PLACED",
  PLACED: "ORDER_PLACED",
  PENDING: "ORDER_PLACED",
  PICKUP_GENERATED: "PICKUP_GENERATED",
  PICKUP_SCHEDULED: "PICKUP_GENERATED",
  PICKUP: "PICKUP_GENERATED",
  PICKUP_PENDING: "PICKUP_GENERATED",
  CREATED: "PICKUP_GENERATED",
  BOOKED: "PICKUP_GENERATED",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "IN_TRANSIT",
  INTRANSIT: "IN_TRANSIT",
  SHIPPED: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  OUTFORDELIVERY: "OUT_FOR_DELIVERY",
  OFD: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY: "DELIVERED",
};

export function normalizeShipmozoWebhookStatus(raw: string): ShipmozoTrackingStatus | null {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_ALIASES[key] ?? (SHIPMOZO_TRACKING_STEPS.includes(key as ShipmozoTrackingStatus) ? (key as ShipmozoTrackingStatus) : null);
}

export function shipmentStatusFromLegacyEnum(status: string | null | undefined): ShipmozoTrackingStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "DELIVERED") return "DELIVERED";
  if (s === "IN_TRANSIT") return "IN_TRANSIT";
  if (s === "CREATED") return "PICKUP_GENERATED";
  return "ORDER_PLACED";
}

export function resolveOrderTrackingStatus(input: {
  shipment_status?: string | null;
  awb_number?: string | null;
  legacy_shipment_status?: string | null;
  legacy_tracking_number?: string | null;
}): ShipmozoTrackingStatus {
  const normalized = input.shipment_status
    ? normalizeShipmozoWebhookStatus(input.shipment_status)
    : null;
  if (normalized) return normalized;
  if (input.awb_number || input.legacy_tracking_number) {
    return shipmentStatusFromLegacyEnum(input.legacy_shipment_status);
  }
  return "ORDER_PLACED";
}

export function mapTrackingStatusToShipmentEnum(status: ShipmozoTrackingStatus): string {
  switch (status) {
    case "PICKUP_GENERATED":
      return "CREATED";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "IN_TRANSIT";
    case "DELIVERED":
      return "DELIVERED";
    default:
      return "PENDING";
  }
}

function normalizeRef(value: string): string {
  return value.trim().replace(/-/g, "").toUpperCase();
}

export async function findOrderForShipmozoWebhook(input: {
  awb?: string;
  orderId?: string;
}) {
  const awb = (input.awb ?? "").trim();
  const orderIdRef = (input.orderId ?? "").trim();

  if (awb) {
    const byOrderAwb = await prisma.orders.findFirst({
      where: { awb_number: awb },
      select: { id: true, shipment_status: true, order_number: true },
    });
    if (byOrderAwb) return byOrderAwb;

    const shipment = await prisma.shipments.findFirst({
      where: { tracking_number: awb },
      select: { order_id: true },
    });
    if (shipment) {
      const order = await prisma.orders.findUnique({
        where: { id: shipment.order_id },
        select: { id: true, shipment_status: true, order_number: true },
      });
      if (order) return order;
    }
  }

  if (orderIdRef) {
    if (isUuid(orderIdRef)) {
      const byUuid = await prisma.orders.findUnique({
        where: { id: orderIdRef },
        select: { id: true, shipment_status: true, order_number: true },
      });
      if (byUuid) return byUuid;
    }

    const refNorm = normalizeRef(orderIdRef);
    const recent = await prisma.orders.findMany({
      orderBy: { created_at: "desc" },
      take: 500,
      select: { id: true, shipment_status: true, order_number: true },
    });
    const byRef = recent.find((o) => normalizeRef(shipmozoOrderRef(o)) === refNorm);
    if (byRef) return byRef;

    const byNumber = await prisma.orders.findFirst({
      where: { order_number: { equals: orderIdRef, mode: "insensitive" } },
      select: { id: true, shipment_status: true, order_number: true },
    });
    if (byNumber) return byNumber;
  }

  return null;
}

export type ShipmozoWebhookPayload = {
  awb?: string;
  order_id?: string;
  status?: string;
  timestamp?: string;
  carrier?: string;
  location?: string;
};

export async function applyShipmozoWebhookUpdate(payload: ShipmozoWebhookPayload) {
  const statusRaw = String(payload.status ?? "").trim();
  const mappedStatus = normalizeShipmozoWebhookStatus(statusRaw);
  if (!mappedStatus) {
    return { ok: false as const, error: `Unsupported status: ${statusRaw}`, status: 400 };
  }

  const order = await findOrderForShipmozoWebhook({
    awb: payload.awb,
    orderId: payload.order_id,
  });
  if (!order) {
    return { ok: false as const, error: "Order not found", status: 404 };
  }

  const awb = (payload.awb ?? "").trim() || undefined;
  const carrier = (payload.carrier ?? "").trim() || undefined;
  const location = (payload.location ?? "").trim() || undefined;
  const updatedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const shipmentEnum = mapTrackingStatusToShipmentEnum(mappedStatus);

  const previousStatus = order.shipment_status;
  const shouldSendPickupEmail =
    mappedStatus === "PICKUP_GENERATED" && previousStatus !== "PICKUP_GENERATED";

  await prisma.$transaction(async (tx) => {
    const existingShipment = await tx.shipments.findUnique({
      where: { order_id: order.id },
      select: { metadata: true },
    });
    const prevMeta =
      existingShipment?.metadata && typeof existingShipment.metadata === "object"
        ? (existingShipment.metadata as Record<string, unknown>)
        : {};
    const prevShipmozo =
      typeof prevMeta.shipmozo === "object" && prevMeta.shipmozo
        ? (prevMeta.shipmozo as Record<string, unknown>)
        : {};

    await tx.orders.update({
      where: { id: order.id },
      data: {
        shipment_status: mappedStatus,
        shipment_updated_at: updatedAt,
        ...(awb ? { awb_number: awb } : {}),
        ...(carrier ? { carrier } : {}),
        ...(location ? { shipment_location: location } : {}),
      },
    });

    const shipmentData = {
      status: shipmentEnum as any,
      ...(awb ? { tracking_number: awb } : {}),
      ...(carrier ? { carrier } : {}),
      ...(mappedStatus === "DELIVERED" ? { delivered_at: updatedAt } : {}),
      ...(mappedStatus === "PICKUP_GENERATED" || mappedStatus === "IN_TRANSIT"
        ? { shipped_at: updatedAt }
        : {}),
      metadata: {
        ...prevMeta,
        shipmozo: {
          ...prevShipmozo,
          lastWebhook: payload,
          lastStatus: mappedStatus,
          updatedAt: updatedAt.toISOString(),
        },
      } as object,
    };

    await tx.shipments.upsert({
      where: { order_id: order.id },
      create: {
        order_id: order.id,
        tracking_number: awb ?? null,
        carrier: carrier ?? "Shipmozo",
        ...shipmentData,
      },
      update: shipmentData,
    });

    if (mappedStatus === "DELIVERED") {
      await tx.orders.update({
        where: { id: order.id },
        data: { status: "DELIVERED" },
      });
    } else if (mappedStatus === "IN_TRANSIT" || mappedStatus === "OUT_FOR_DELIVERY") {
      await tx.orders.update({
        where: { id: order.id },
        data: { status: "SHIPPED" },
      });
    }
  });

  return {
    ok: true as const,
    orderId: order.id,
    previousStatus,
    mappedStatus,
    shouldSendPickupEmail,
    awb: awb ?? null,
    carrier: carrier ?? null,
  };
}

const DEFAULT_SYNC_MIN_AGE_MS = 10 * 60 * 1000;

export async function syncShipmozoTrackingForOrder(
  orderId: string,
  options?: { minAgeMs?: number; force?: boolean }
) {
  try {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        awb_number: true,
        carrier: true,
        shipment_status: true,
        shipment_updated_at: true,
        shipments: { select: { tracking_number: true } },
      },
    });
    if (!order) return { ok: false as const, error: "Order not found" };

    const awb = (order.awb_number ?? order.shipments?.tracking_number ?? "").trim();
    if (!awb) return { ok: true as const, skipped: true as const, reason: "no_awb" };
    if (order.shipment_status === "DELIVERED") {
      return { ok: true as const, skipped: true as const, reason: "already_delivered" };
    }

    const minAgeMs = options?.minAgeMs ?? DEFAULT_SYNC_MIN_AGE_MS;
    if (
      !options?.force &&
      order.shipment_updated_at &&
      Date.now() - order.shipment_updated_at.getTime() < minAgeMs
    ) {
      return { ok: true as const, skipped: true as const, reason: "recently_synced" };
    }

    const track = await fetchShipmozoTrackOrder(awb);
    if (!track.ok) {
      console.warn("[shipmozo-sync] track-order failed", { orderId, awb, error: track.error });
      return { ok: false as const, error: track.error ?? "track-order failed" };
    }

    const statusRaw = track.current_status ?? "";
    if (!statusRaw.trim()) {
      return { ok: true as const, skipped: true as const, reason: "empty_status" };
    }

    const result = await applyShipmozoWebhookUpdate({
      awb,
      order_id: orderId,
      status: statusRaw,
      timestamp: track.status_time ?? new Date().toISOString(),
      carrier: track.courier ?? order.carrier ?? undefined,
    });

    if (!result.ok) return result;

    if (result.shouldSendPickupEmail) {
      try {
        await sendPickupEmail(result.orderId);
      } catch (emailErr) {
        console.error("[shipmozo-sync] pickup email failed", { orderId, emailErr });
      }
    }

    return { ok: true as const, orderId, mappedStatus: result.mappedStatus };
  } catch (err) {
    console.error("[shipmozo-sync] unhandled error", { orderId, err });
    return { ok: false as const, error: "sync failed" };
  }
}

export async function runShipmozoTrackingSync() {
  const lookbackDays = Math.max(1, Number(process.env.SHIPMOZO_TRACKING_LOOKBACK_DAYS ?? 45) || 45);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const batchSize = Math.max(1, Math.min(100, Number(process.env.SHIPMOZO_TRACKING_BATCH_SIZE ?? 40) || 40));

  const orders = await prisma.orders.findMany({
    where: {
      created_at: { gte: since },
      shipment_status: { not: "DELIVERED" },
      OR: [{ awb_number: { not: null } }, { shipments: { tracking_number: { not: null } } }],
    },
    orderBy: [{ shipment_updated_at: "asc" }, { created_at: "desc" }],
    take: batchSize,
    select: { id: true },
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of orders) {
    const result = await syncShipmozoTrackingForOrder(row.id);
    if (!result.ok) failed += 1;
    else if ("skipped" in result && result.skipped) skipped += 1;
    else synced += 1;
  }

  return { scanned: orders.length, synced, skipped, failed };
}
