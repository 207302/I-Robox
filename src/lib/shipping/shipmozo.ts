import { prisma } from "@/lib/prisma";
import { shipmozoOrderRef } from "@/lib/orders/orderNumber";
import { sendPickupEmail } from "@/lib/email/sendPickupEmail";
import { computeOrderPackageDetails } from "@/lib/shipping/orderPackageDetails";
import { taxableUnitPrice } from "@/lib/tax/productTaxFields";

const SHIPMOZO_BASE_DEFAULT = "https://shipping-api.com/app/api/v1";

/** ShipMozo requires L×W×H; box size is not stored per product. */
const SHIPMOZO_DEFAULT_LENGTH_CM = 10;
const SHIPMOZO_DEFAULT_WIDTH_CM = 10;
const SHIPMOZO_DEFAULT_HEIGHT_CM = 10;

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

export type ShipmozoTrackOrderResult = {
  ok: boolean;
  current_status?: string;
  status_time?: string;
  courier?: string;
  awb_number?: string;
  error?: string;
};

export type ShipmozoOrderDetailResult = {
  ok: boolean;
  awb_number?: string;
  courier?: string;
  status?: string;
  shipmozo_order_id?: string;
  lookup_id?: string;
  error?: string;
};

const AWB_FIELD_KEYS = [
  "awb_number",
  "awb",
  "AWB",
  "awb_no",
  "tracking_number",
  "lr_number",
] as const;

const STATUS_FIELD_KEYS = [
  "current_status",
  "order_status",
  "status",
  "shipment_status",
] as const;

const COURIER_FIELD_KEYS = ["courier_company", "courier", "courier_name"] as const;

function readStringField(obj: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function looksLikeAwb(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 20;
}

function parseShipmozoOrderDetailData(data: unknown): Omit<ShipmozoOrderDetailResult, "ok" | "lookup_id"> | null {
  if (data == null) return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const parsed = parseShipmozoOrderDetailData(item);
      if (parsed) return parsed;
    }
    return null;
  }

  if (typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const awb = readStringField(d, AWB_FIELD_KEYS);
  const courier = readStringField(d, COURIER_FIELD_KEYS) || undefined;
  const status = readStringField(d, STATUS_FIELD_KEYS) || "PICKUP_GENERATED";
  const shipmozo_order_id = readStringField(d, ["order_id", "id"]) || undefined;
  const reference_id = readStringField(d, ["reference_id"]) || undefined;

  if (awb && looksLikeAwb(awb)) {
    return { awb_number: awb, courier, status, shipmozo_order_id: shipmozo_order_id || reference_id };
  }

  for (const value of Object.values(d)) {
    if (value && typeof value === "object") {
      const nested = parseShipmozoOrderDetailData(value);
      if (nested) {
        return {
          ...nested,
          shipmozo_order_id: nested.shipmozo_order_id ?? shipmozo_order_id ?? reference_id,
        };
      }
    }
  }

  return null;
}

function shipmozoResponseData(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return null;
  return (parsed as ShipmozoResponse).data ?? null;
}

/** Collect every ShipMozo order id we might look up (reference + panel ids, case variants). */
export function collectShipmozoLookupIds(input: {
  customerRef: string;
  metadata?: Record<string, unknown>;
}): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const normalized = normalizeShipmozoOrderIdRef(String(value ?? ""));
    if (!normalized) return;
    ids.add(normalized);
    ids.add(normalized.toUpperCase());
    ids.add(normalized.toLowerCase());
  };

  add(input.customerRef);
  if (input.metadata) {
    add(input.metadata.reference_id);
    add(input.metadata.shipmozo_order_id);

    const pushOrder = input.metadata.pushOrder;
    if (pushOrder && typeof pushOrder === "object") {
      const response = (pushOrder as Record<string, unknown>).response;
      if (response && typeof response === "object") {
        const data = (response as Record<string, unknown>).data;
        if (data && typeof data === "object") {
          if (Array.isArray(data)) {
            for (const row of data) {
              if (row && typeof row === "object") {
                add((row as Record<string, unknown>).order_id);
                add((row as Record<string, unknown>).reference_id);
              }
            }
          } else {
            add((data as Record<string, unknown>).order_id);
            add((data as Record<string, unknown>).reference_id);
          }
        }
      }
    }
  }

  return [...ids];
}

/** Fetch ShipMozo order detail, trying multiple order ids until AWB is found. */
export async function fetchShipmozoOrderDetailWithCandidates(
  lookupIds: string[]
): Promise<ShipmozoOrderDetailResult> {
  const unique = [...new Set(lookupIds.map((id) => normalizeShipmozoOrderIdRef(id)).filter(Boolean))];

  if (unique.length === 0) return { ok: false, error: "missing_order_id" };
  if (!isShipmozoConfigured()) return { ok: false, error: "shipmozo_not_configured" };

  let lastError = "get_order_detail_failed";

  for (const id of unique) {
    const res = await callShipmozo(`/get-order-detail/${encodeURIComponent(id)}`, "GET");
    if (!res.ok || !res.parsed || typeof res.parsed !== "object") {
      lastError = "get_order_detail_failed";
      continue;
    }

    const parsed = parseShipmozoOrderDetailData(shipmozoResponseData(res.parsed));
    if (!parsed?.awb_number) {
      lastError = "no_awb_on_shipmozo_order";
      continue;
    }

    return { ok: true, ...parsed, lookup_id: id };
  }

  return { ok: false, error: lastError };
}

/** Fetch ShipMozo order by panel/API order id (e.g. IRx10001) — used when AWB is assigned manually. */
export async function fetchShipmozoOrderDetail(
  shipmozoOrderId: string
): Promise<ShipmozoOrderDetailResult> {
  return fetchShipmozoOrderDetailWithCandidates([shipmozoOrderId]);
}

export function isShipmozoIntegrationConfigured(): boolean {
  return isShipmozoConfigured();
}

export async function fetchShipmozoTrackOrder(awb: string): Promise<ShipmozoTrackOrderResult> {
  const awbNumber = awb.trim();
  if (!awbNumber) return { ok: false, error: "missing_awb" };
  if (!isShipmozoConfigured()) return { ok: false, error: "shipmozo_not_configured" };

  const res = await callShipmozo(
    `/track-order?awb_number=${encodeURIComponent(awbNumber)}`,
    "GET"
  );
  if (!res.ok || !res.parsed || typeof res.parsed !== "object") {
    return { ok: false, error: "track_order_request_failed" };
  }

  const data = (res.parsed as ShipmozoResponse).data;
  if (!data || typeof data !== "object") {
    return { ok: false, error: "invalid_track_order_response" };
  }

  return {
    ok: true,
    current_status: String(data.current_status ?? "").trim() || undefined,
    status_time: data.status_time ? String(data.status_time) : undefined,
    courier: data.courier ? String(data.courier) : undefined,
    awb_number: data.awb_number ? String(data.awb_number) : awbNumber,
  };
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

export async function appendShipmozoMetadata(orderId: string, patch: Record<string, unknown>) {
  const { ensureOrderShipmentCreated } = await import("@/lib/orders/ensureOrderShipment");
  await ensureOrderShipmentCreated(orderId);

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
          products: { select: { hsn_code: true, gst_percent: true, weight_g: true } },
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

  const packageDetails = computeOrderPackageDetails(
    (order.order_items ?? []).map((it) => ({
      quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
      weightG: it.products?.weight_g ?? null,
    }))
  );

  const total = Number(order.total_amount);
  const totalAmount = Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
  const lineItems = (order.order_items ?? []).map((it) => {
    const gstPercent = it.products?.gst_percent ?? 0;
    const inclusiveUnit = Number(it.unit_price ?? 0);
    return {
      name: String(it.product_name ?? "Item").slice(0, 200),
      sku_number: "",
      quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
      discount: "",
      hsn: String(it.products?.hsn_code ?? ""),
      gst: gstPercent,
      unit_price: taxableUnitPrice(inclusiveUnit, gstPercent),
      product_category: "Other",
    };
  });

  const missingTax = (order.order_items ?? []).filter((it) => {
    const hsn = String(it.products?.hsn_code ?? "").trim();
    const gst = it.products?.gst_percent;
    return !hsn || gst == null;
  });
  if (missingTax.length > 0) {
    const names = missingTax.map((it) => String(it.product_name ?? "Item").slice(0, 80));
    await appendShipmozoMetadata(orderId, {
      status: "skipped",
      reason: "missing_product_hsn_or_gst",
      products: names,
    });
    return;
  }

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
    weight: packageDetails.weightG,
    length: SHIPMOZO_DEFAULT_LENGTH_CM,
    width: SHIPMOZO_DEFAULT_WIDTH_CM,
    height: SHIPMOZO_DEFAULT_HEIGHT_CM,
    warehouse_id: warehouseId,
    gst_ewaybill_number: "",
    gstin_number: (process.env.SELLER_GSTIN ?? process.env.SHIPMOZO_GSTIN ?? "").trim(),
  };

  const push = await callShipmozo("/push-order", "POST", pushPayload);
  await appendShipmozoMetadata(orderId, { pushOrder: { ok: push.ok, status: push.status, response: push.parsed } });
  if (!push.ok) return;

  const customerRef = normalizeShipmozoOrderIdRef(shipmozoOrderRef(order));
  const createdOrderId = normalizeShipmozoOrderIdRef(
    typeof push.parsed === "object" && push.parsed && "data" in push.parsed
      ? String((push.parsed as ShipmozoResponse).data?.order_id ?? pushPayload.order_id)
      : String(pushPayload.order_id)
  );

  await appendShipmozoMetadata(orderId, {
    reference_id: customerRef,
    ...(createdOrderId !== customerRef ? { shipmozo_order_id: createdOrderId } : {}),
    status: "awaiting_shipment",
  });

  let awb = "";
  let courier = "Shipmozo";

  const autoAssignEnabled = process.env.SHIPMOZO_AUTO_ASSIGN_ENABLED === "1";
  if (autoAssignEnabled) {
    const autoAssign = await callShipmozo("/auto-assign-order", "POST", { order_id: createdOrderId });
    await appendShipmozoMetadata(orderId, {
      autoAssign: { ok: autoAssign.ok, status: autoAssign.status, response: autoAssign.parsed },
    });

    awb =
      typeof autoAssign.parsed === "object" && autoAssign.parsed && "data" in autoAssign.parsed
        ? String((autoAssign.parsed as ShipmozoResponse).data?.awb_number ?? "")
        : "";
    courier =
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
  }

  if (!awb) {
    const detail = await fetchShipmozoOrderDetailWithCandidates([createdOrderId, customerRef]);
    await appendShipmozoMetadata(orderId, {
      orderDetail: { ok: detail.ok, awb: detail.awb_number ?? null, error: detail.error ?? null },
    });
    if (detail.ok && detail.awb_number) {
      awb = detail.awb_number;
      courier = detail.courier ?? courier;
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
  if (awb) {
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        awb_number: awb,
        carrier: courier || "Shipmozo",
        shipment_status: "PICKUP_GENERATED",
        shipment_updated_at: new Date(),
      },
    });
    try {
      await sendPickupEmail(orderId);
    } catch (emailErr) {
      console.error("[shipmozo-booking] pickup email failed", { orderId, emailErr });
    }
  }
  await appendShipmozoMetadata(orderId, {
    status: awb ? "booked" : "pending",
    awb_number: awb || null,
    courier: courier || "Shipmozo",
    reference_id: customerRef,
    ...(createdOrderId !== customerRef ? { shipmozo_order_id: createdOrderId } : {}),
    package: packageDetails,
  });
}

