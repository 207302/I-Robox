import { prisma } from "@/lib/prisma";
import { shipmozoOrderRef } from "@/lib/orders/orderNumber";

const SHIPMOZO_BASE_DEFAULT = "https://shipping-api.com/app/api/v1";

/** Shipmozo rejects ref / order_id longer than this (e.g. auto-assign, schedule pickup). */
const SHIPMOZO_ORDER_ID_MAX_LEN = 30;

function normalizeShipmozoOrderIdRef(value: string): string {
  return String(value).replace(/-/g, "").slice(0, SHIPMOZO_ORDER_ID_MAX_LEN);
}

type ShipmozoResponse = {
  result?: string;
  message?: string;
  data?: any;
};

function shipmozoBaseUrl() {
  return (process.env.SHIPMOZO_BASE_URL ?? SHIPMOZO_BASE_DEFAULT).trim().replace(/\/$/, "");
}

function shipmozoHeaders() {
  return {
    "public-key": (process.env.SHIPMOZO_PUBLIC_KEY ?? "").trim(),
    "private-key": (process.env.SHIPMOZO_PRIVATE_KEY ?? "").trim(),
    "Content-Type": "application/json",
  };
}

function isShipmozoConfigured() {
  return Boolean(
    (process.env.SHIPMOZO_PUBLIC_KEY ?? "").trim() &&
      (process.env.SHIPMOZO_PRIVATE_KEY ?? "").trim() &&
      ((process.env.SHIPMOZO_WAREHOUSE_ID ?? "").trim() || (process.env.SHIPMOZO_WAREHOUSE_TITLE ?? "").trim())
  );
}

async function callShipmozo(
  endpoint: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; parsed: ShipmozoResponse | unknown; raw: string }> {
  const res = await fetch(`${shipmozoBaseUrl()}${endpoint}`, {
    method,
    headers: shipmozoHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await res.text();
  let parsed: ShipmozoResponse | unknown = raw;
  try {
    parsed = JSON.parse(raw) as ShipmozoResponse;
  } catch {
    parsed = raw;
  }
  const logicalOk =
    res.ok &&
    (typeof parsed !== "object" ||
      parsed === null ||
      !("result" in parsed) ||
      String((parsed as ShipmozoResponse).result ?? "") === "1");
  return { ok: logicalOk, status: res.status, parsed, raw };
}

function normalizeIndiaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length >= 11 && digits.startsWith("0")) return digits.slice(-10);
  if (digits.length >= 10) return digits.slice(-10);
  return digits.slice(0, 10);
}

function normalizeIndiaPin6(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 6) return null;
  const six = d.length === 6 ? d : d.slice(-6);
  return /^\d{6}$/.test(six) ? six : null;
}

async function resolveWarehouseId(): Promise<string | null> {
  const explicitId = (process.env.SHIPMOZO_WAREHOUSE_ID ?? "").trim();
  if (explicitId) return explicitId;
  const title = (process.env.SHIPMOZO_WAREHOUSE_TITLE ?? "").trim();
  if (!title) return null;
  const w = await callShipmozo("/get-warehouses", "GET");
  if (!w.ok || !w.parsed || typeof w.parsed !== "object") return null;
  const data = Array.isArray((w.parsed as ShipmozoResponse).data) ? (w.parsed as ShipmozoResponse).data : [];
  const match = data.find((it: any) => String(it?.address_title ?? "").trim() === title);
  return match ? String(match.id) : null;
}

async function appendShipmozoMetadata(orderId: string, patch: Record<string, unknown>) {
  const row = await prisma.shipments.findUnique({ where: { order_id: orderId }, select: { metadata: true } });
  const prev = (row?.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
  await prisma.shipments.updateMany({
    where: { order_id: orderId },
    data: {
      metadata: {
        ...prev,
        shipmozo: {
          ...(typeof prev.shipmozo === "object" && prev.shipmozo ? (prev.shipmozo as object) : {}),
          ...patch,
        },
      } as object,
    },
  });
}

export async function bookShipmozoShipmentForOrder(orderId: string): Promise<void> {
  if (!isShipmozoConfigured()) return;

  const existing = await prisma.shipments.findUnique({
    where: { order_id: orderId },
    select: { tracking_number: true, metadata: true },
  });
  if (existing?.tracking_number) return;

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      total_amount: true,
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
      order_items: {
        select: {
          product_name: true,
          quantity: true,
          unit_price: true,
          products: { select: { hsn_code: true } },
        },
      },
    },
  });
  const addr = order?.addresses_orders_shipping_address_idToaddresses;
  if (!order || !addr) {
    await appendShipmozoMetadata(orderId, { status: "skipped", reason: "missing_shipping_address" });
    return;
  }

  const warehouseId = await resolveWarehouseId();
  if (!warehouseId) {
    await appendShipmozoMetadata(orderId, {
      status: "error",
      reason: "warehouse_not_resolved",
      message: "Could not resolve Shipmozo warehouse_id from SHIPMOZO_WAREHOUSE_ID/SHIPMOZO_WAREHOUSE_TITLE.",
    });
    return;
  }

  const phone = normalizeIndiaPhone(addr.phone ?? "");
  const pin = normalizeIndiaPin6(addr.postal_code ?? "");
  if (phone.length !== 10 || !pin) {
    await appendShipmozoMetadata(orderId, {
      status: "skipped",
      reason: "invalid_contact_or_pin",
      phone,
      pin,
    });
    return;
  }

  const defaultWeightG = Math.max(1, Math.min(30_000, Number(process.env.SHIPMOZO_DEFAULT_WEIGHT_G ?? "500") || 500));
  const length = Number(process.env.SHIPMOZO_DEFAULT_LENGTH_CM ?? "10") || 10;
  const width = Number(process.env.SHIPMOZO_DEFAULT_WIDTH_CM ?? "10") || 10;
  const height = Number(process.env.SHIPMOZO_DEFAULT_HEIGHT_CM ?? "10") || 10;

  const total = Number(order.total_amount);
  const totalAmount = Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
  const lineItems = (order.order_items ?? []).map((it) => ({
    name: String(it.product_name ?? "Item").slice(0, 200),
    sku_number: "",
    quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
    discount: "",
    hsn: String(it.products?.hsn_code ?? ""),
    unit_price: Number(it.unit_price ?? 0),
    product_category: "Other",
  }));

  const pushPayload: Record<string, unknown> = {
    order_id: shipmozoOrderRef(order),
    order_date: new Date().toISOString().slice(0, 10),
    consignee_name: String(addr.full_name ?? "Customer").slice(0, 120),
    consignee_phone: Number(phone),
    consignee_email: "",
    consignee_address_line_one: String(addr.line1 ?? "").slice(0, 240),
    consignee_address_line_two: String(addr.line2 ?? "").slice(0, 240),
    consignee_pin_code: Number(pin),
    consignee_city: String(addr.city ?? "").slice(0, 120),
    consignee_state: String(addr.state ?? "").slice(0, 120),
    product_detail: lineItems,
    payment_type: "PREPAID",
    cod_amount: "",
    weight: defaultWeightG,
    length,
    width,
    height,
    warehouse_id: warehouseId,
    gst_ewaybill_number: "",
    gstin_number: (process.env.SELLER_GSTIN ?? process.env.SHIPMOZO_GSTIN ?? "").trim(),
  };

  const push = await callShipmozo("/push-order", "POST", pushPayload);
  await appendShipmozoMetadata(orderId, { pushOrder: { ok: push.ok, status: push.status, response: push.parsed } });
  if (!push.ok) return;

  const createdOrderId = normalizeShipmozoOrderIdRef(
    typeof push.parsed === "object" && push.parsed && "data" in push.parsed
      ? String((push.parsed as ShipmozoResponse).data?.order_id ?? pushPayload.order_id)
      : String(pushPayload.order_id)
  );

  const autoAssign = await callShipmozo("/auto-assign-order", "POST", { order_id: createdOrderId });
  await appendShipmozoMetadata(orderId, { autoAssign: { ok: autoAssign.ok, status: autoAssign.status, response: autoAssign.parsed } });

  let awb =
    typeof autoAssign.parsed === "object" && autoAssign.parsed && "data" in autoAssign.parsed
      ? String((autoAssign.parsed as ShipmozoResponse).data?.awb_number ?? "")
      : "";
  let courier =
    typeof autoAssign.parsed === "object" && autoAssign.parsed && "data" in autoAssign.parsed
      ? String(
          (autoAssign.parsed as ShipmozoResponse).data?.courier_company ??
            (autoAssign.parsed as ShipmozoResponse).data?.courier ??
            "Shipmozo"
        )
      : "Shipmozo";

  if (!awb && (process.env.SHIPMOZO_AUTO_SCHEDULE_PICKUP ?? "1") === "1") {
    const schedule = await callShipmozo("/schedule-pickup", "POST", { order_id: createdOrderId });
    await appendShipmozoMetadata(orderId, {
      schedulePickup: { ok: schedule.ok, status: schedule.status, response: schedule.parsed },
    });
    if (schedule.ok && typeof schedule.parsed === "object" && schedule.parsed && "data" in schedule.parsed) {
      awb = String((schedule.parsed as ShipmozoResponse).data?.awb_number ?? awb);
      courier = String((schedule.parsed as ShipmozoResponse).data?.courier ?? courier);
    }
  }

  if (!awb) {
    const detail = await callShipmozo(`/get-order-detail/${encodeURIComponent(createdOrderId)}`, "GET");
    await appendShipmozoMetadata(orderId, { orderDetail: { ok: detail.ok, status: detail.status, response: detail.parsed } });
    if (detail.ok && typeof detail.parsed === "object" && detail.parsed && "data" in detail.parsed) {
      awb = String((detail.parsed as ShipmozoResponse).data?.awb_number ?? awb);
      courier = String(
        (detail.parsed as ShipmozoResponse).data?.courier_company ??
          (detail.parsed as ShipmozoResponse).data?.courier ??
          courier
      );
    }
  }

  await prisma.shipments.updateMany({
    where: { order_id: orderId },
    data: {
      carrier: courier || "Shipmozo",
      tracking_number: awb || null,
      status: awb ? "CREATED" : "PENDING",
    },
  });
  await appendShipmozoMetadata(orderId, {
    status: awb ? "booked" : "pending",
    awb_number: awb || null,
    courier: courier || "Shipmozo",
    reference_id: createdOrderId,
  });
}

