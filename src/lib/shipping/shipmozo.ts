import { prisma } from "@/lib/prisma";
import { shipmozoOrderRef } from "@/lib/orders/orderNumber";
import { sendPickupEmail } from "@/lib/email/sendPickupEmail";
import { computeOrderPackageDetails } from "@/lib/shipping/orderPackageDetails";

const SHIPMOZO_BASE_DEFAULT = "https://shipping-api.com/app/api/v1";

/** ShipMozo requires L×W×H; box size is not stored per product. */
const SHIPMOZO_DEFAULT_LENGTH_CM = 10;
const SHIPMOZO_DEFAULT_WIDTH_CM = 10;
const SHIPMOZO_DEFAULT_HEIGHT_CM = 10;

/** Shipmozo rejects ref / order_id longer than this (e.g. auto-assign, schedule pickup). */
const SHIPMOZO_ORDER_ID_MAX_LEN = 30;

const WAREHOUSE_LIST_CACHE_MS = 5 * 60 * 1000;

export type ShipmozoWarehouseSummary = {
  id: string;
  address_title: string;
  status: string;
  default: boolean;
};

export type ShipmozoWarehouseValidation = {
  configuredId: string | null;
  configuredTitle: string | null;
  foundInApi: boolean;
  validWarehouses: ShipmozoWarehouseSummary[];
  validatedAt: string;
};

type WarehouseListCache = {
  fetchedAt: number;
  apiOk: boolean;
  warehouses: ShipmozoWarehouseSummary[];
};

let warehouseListCache: WarehouseListCache | null = null;

export type ShipmozoBookingResult = {
  ok: boolean;
  error?: string;
  reason?: string;
  skipped?: boolean;
};

function productHsnForShipmozo(product: { hsn_code?: string | null }): string {
  const hsnRaw = String(product.hsn_code ?? "").trim();
  if (hsnRaw) return hsnRaw;
  return (process.env.SHIPMOZO_DEFAULT_HSN ?? "").trim();
}

function scrubPushPayloadForMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const phone = copy.consignee_phone;
  if (phone != null) {
    const digits = String(phone).replace(/\D/g, "");
    const last4 = digits.slice(-4);
    copy.consignee_phone = last4 ? `******${last4}` : "****";
  }
  return copy;
}

function maskShipmozoSecret(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 4) return "***";
  return `${v.slice(0, 4)}***`;
}

function parseWarehouseListFromResponse(parsed: unknown): ShipmozoWarehouseSummary[] {
  if (!parsed || typeof parsed !== "object") return [];
  const data = (parsed as ShipmozoResponse).data;
  if (!Array.isArray(data)) return [];
  return data
    .map((row: Record<string, unknown>) => ({
      id: String(row.id ?? "").trim(),
      address_title: String(row.address_title ?? row.title ?? "").trim(),
      status: String(row.status ?? row.warehouse_status ?? "").trim(),
      default: Boolean(row.default ?? row.is_default ?? row.isDefault),
    }))
    .filter((row) => row.id);
}

export async function fetchShipmozoWarehouseList(options?: { forceRefresh?: boolean }): Promise<WarehouseListCache> {
  if (
    !options?.forceRefresh &&
    warehouseListCache &&
    Date.now() - warehouseListCache.fetchedAt < WAREHOUSE_LIST_CACHE_MS
  ) {
    return warehouseListCache;
  }

  const res = await callShipmozo("/get-warehouses", "GET");
  const warehouses = parseWarehouseListFromResponse(res.parsed);
  warehouseListCache = {
    fetchedAt: Date.now(),
    apiOk: res.ok,
    warehouses,
  };
  return warehouseListCache;
}

function shipmozoPushErrorMessage(parsed: unknown, raw?: string): string {
  if (parsed && typeof parsed === "object") {
    const p = parsed as ShipmozoResponse & { data?: unknown };
    const msg = String(p.message ?? "").trim();
    if (msg && msg.toLowerCase() !== "error") return msg;
    if (p.data && typeof p.data === "object") {
      const data = p.data as Record<string, unknown>;
      for (const key of ["error", "errors", "message", "detail"]) {
        const value = data[key];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (Array.isArray(value) && value.length > 0) {
          return value.map((v) => String(v)).join("; ");
        }
      }
      const nested = JSON.stringify(p.data);
      if (nested && nested !== "{}") return nested.slice(0, 500);
    }
    if (msg) return msg;
  }
  const rawText = String(raw ?? "").trim();
  if (rawText && rawText.length <= 500) return rawText;
  return "ShipMozo rejected the order — check API keys and warehouse env vars on the server";
}

function priorPushSucceeded(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const shipmozo = (metadata as Record<string, unknown>).shipmozo;
  if (!shipmozo || typeof shipmozo !== "object") return false;
  const pushOrder = (shipmozo as Record<string, unknown>).pushOrder;
  if (!pushOrder || typeof pushOrder !== "object") return false;
  return (pushOrder as Record<string, unknown>).ok === true;
}

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
  panelOrders?: ShipmozoPanelOrderSummary[];
  duplicateCount?: number;
};

export type ShipmozoPanelOrderSummary = {
  shipmozo_order_id: string;
  reference_id?: string;
  awb_number?: string;
  courier?: string;
  status?: string;
  lookup_id: string;
};

export type ShipmozoDiscoveryResult = ShipmozoOrderDetailResult & {
  panelOrders: ShipmozoPanelOrderSummary[];
  duplicateCount: number;
  triedIds: string[];
};

const SHIPMOZO_LINKED_ORDER_ID_KEYS = [
  "shipment_order_id",
  "scheduled_order_id",
  "linked_order_id",
  "sm_order_id",
  "forward_order_id",
] as const;

export function normalizeShipmozoCustomerRef(ref: string): string {
  return String(ref).replace(/-/g, "").trim().toUpperCase();
}

function looksLikeShipmozoPanelOrderId(value: string): boolean {
  return /^50232[A-Z]{2}\d+$/i.test(value.trim());
}

function rankPanelOrder(summary: ShipmozoPanelOrderSummary): number {
  let score = 0;
  if (summary.awb_number) score += 100;
  if (/SM/i.test(summary.shipmozo_order_id)) score += 20;
  if (/scheduled|transit|deliver|pickup complete/i.test(summary.status ?? "")) score += 10;
  if (/AP/i.test(summary.shipmozo_order_id)) score -= 5;
  return score;
}

function pickBestPanelOrder(orders: ShipmozoPanelOrderSummary[]): ShipmozoPanelOrderSummary | null {
  if (orders.length === 0) return null;
  return [...orders].sort((a, b) => rankPanelOrder(b) - rankPanelOrder(a))[0] ?? null;
}

function mergePanelOrderMaps(
  target: Map<string, ShipmozoPanelOrderSummary>,
  incoming: ShipmozoPanelOrderSummary[]
) {
  for (const row of incoming) {
    const id = normalizeShipmozoOrderIdRef(row.shipmozo_order_id);
    if (!id) continue;
    const prev = target.get(id);
    target.set(id, {
      shipmozo_order_id: id,
      lookup_id: row.lookup_id,
      reference_id: row.reference_id ?? prev?.reference_id,
      awb_number: row.awb_number ?? prev?.awb_number,
      courier: row.courier ?? prev?.courier,
      status: row.status ?? prev?.status,
    });
  }
}

function extractPanelOrdersFromShipmozoData(
  data: unknown,
  lookupId: string,
  customerRefNorm: string
): ShipmozoPanelOrderSummary[] {
  const byId = new Map<string, ShipmozoPanelOrderSummary>();

  const visit = (node: unknown) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object") return;

    const d = node as Record<string, unknown>;
    const orderId = readStringField(d, ["order_id", "id", "shipmozo_order_id"]);
    const referenceId = readStringField(d, ["reference_id", "order_ref", "customer_order_id"]);
    const awb = readStringField(d, AWB_FIELD_KEYS);
    const courier = readStringField(d, COURIER_FIELD_KEYS) || undefined;
    const status = readStringField(d, STATUS_FIELD_KEYS) || undefined;

    const refNorm = referenceId ? normalizeShipmozoCustomerRef(referenceId) : "";
    const orderNorm = orderId ? normalizeShipmozoCustomerRef(orderId) : "";
    const matchesRef =
      refNorm === customerRefNorm ||
      orderNorm === customerRefNorm ||
      (Boolean(orderId) && normalizeShipmozoOrderIdRef(orderId) === customerRefNorm);

    if (orderId && (matchesRef || (looksLikeShipmozoPanelOrderId(orderId) && refNorm === customerRefNorm))) {
      const id = normalizeShipmozoOrderIdRef(orderId);
      const prev = byId.get(id);
      byId.set(id, {
        shipmozo_order_id: id,
        lookup_id: lookupId,
        reference_id: referenceId || prev?.reference_id,
        awb_number: awb && looksLikeAwb(awb) ? awb : prev?.awb_number,
        courier: courier || prev?.courier,
        status: status || prev?.status,
      });
    }

    for (const key of SHIPMOZO_LINKED_ORDER_ID_KEYS) {
      const linked = readStringField(d, [key]);
      if (linked && looksLikeShipmozoPanelOrderId(linked)) {
        const id = normalizeShipmozoOrderIdRef(linked);
        const prev = byId.get(id);
        byId.set(id, {
          shipmozo_order_id: id,
          lookup_id: lookupId,
          reference_id: referenceId || prev?.reference_id,
          awb_number: prev?.awb_number,
          courier: prev?.courier,
          status: prev?.status,
        });
      }
    }

    for (const value of Object.values(d)) visit(value);
  };

  visit(data);
  return [...byId.values()];
}

function collectLinkedLookupIds(data: unknown): string[] {
  const ids = new Set<string>();
  const visit = (node: unknown) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object") return;
    const d = node as Record<string, unknown>;
    for (const key of ["order_id", "id", ...SHIPMOZO_LINKED_ORDER_ID_KEYS]) {
      const value = readStringField(d, [key]);
      if (value && looksLikeShipmozoPanelOrderId(value)) {
        ids.add(normalizeShipmozoOrderIdRef(value));
      }
    }
    for (const value of Object.values(d)) visit(value);
  };
  visit(data);
  return [...ids];
}

async function searchShipmozoOrdersByReference(customerRef: string): Promise<ShipmozoPanelOrderSummary[]> {
  const ref = normalizeShipmozoOrderIdRef(customerRef);
  const refNorm = normalizeShipmozoCustomerRef(ref);
  const getEndpoints = [
    `/get-orders?reference_id=${encodeURIComponent(ref)}`,
    `/get-orders?order_id=${encodeURIComponent(ref)}`,
    `/get-orders?search=${encodeURIComponent(ref)}`,
    `/get-order-list?reference_id=${encodeURIComponent(ref)}`,
    `/get-order-detail?reference_id=${encodeURIComponent(ref)}`,
  ];

  const found: ShipmozoPanelOrderSummary[] = [];
  for (const endpoint of getEndpoints) {
    const res = await callShipmozo(endpoint, "GET");
    if (!res.ok) continue;
    const data = shipmozoResponseData(res.parsed);
    const rows = extractPanelOrdersFromShipmozoData(data, ref, refNorm);
    if (rows.length > 0) {
      found.push(...rows);
      break;
    }
  }

  if (found.length === 0) {
    const postRes = await callShipmozo("/get-orders", "POST", {
      reference_id: ref,
      order_id: ref,
      search: ref,
    });
    if (postRes.ok) {
      const data = shipmozoResponseData(postRes.parsed);
      found.push(...extractPanelOrdersFromShipmozoData(data, ref, refNorm));
    }
  }

  return found;
}

/** Scan ShipMozo for every order matching an i-robox ref; prefer records that already have an AWB. */
export async function discoverShipmozoOrdersForRef(input: {
  lookupIds: string[];
  customerRef: string;
}): Promise<ShipmozoDiscoveryResult> {
  const customerRef = normalizeShipmozoOrderIdRef(input.customerRef);
  const customerRefNorm = normalizeShipmozoCustomerRef(customerRef);
  const tried = new Set<string>();
  const panelById = new Map<string, ShipmozoPanelOrderSummary>();
  const queue = [
    ...new Set(
      [...input.lookupIds, customerRef]
        .map((id) => normalizeShipmozoOrderIdRef(id))
        .filter(Boolean)
    ),
  ];

  if (queue.length === 0) {
    return { ok: false, error: "missing_order_id", panelOrders: [], duplicateCount: 0, triedIds: [] };
  }
  if (!isShipmozoConfigured()) {
    return { ok: false, error: "shipmozo_not_configured", panelOrders: [], duplicateCount: 0, triedIds: [] };
  }

  const searchHits = await searchShipmozoOrdersByReference(customerRef);
  mergePanelOrderMaps(panelById, searchHits);
  for (const row of searchHits) {
    queue.push(row.shipmozo_order_id);
  }

  let lastError = "get_order_detail_failed";
  const maxFetches = 24;

  while (queue.length > 0 && tried.size < maxFetches) {
    const id = queue.shift()!;
    if (tried.has(id)) continue;
    tried.add(id);

    const res = await callShipmozo(`/get-order-detail/${encodeURIComponent(id)}`, "GET");
    if (!res.ok || !res.parsed || typeof res.parsed !== "object") {
      lastError = "get_order_detail_failed";
      continue;
    }

    const data = shipmozoResponseData(res.parsed);
    mergePanelOrderMaps(panelById, extractPanelOrdersFromShipmozoData(data, id, customerRefNorm));

    for (const linkedId of collectLinkedLookupIds(data)) {
      if (!tried.has(linkedId)) queue.push(linkedId);
    }

    const parsed = parseShipmozoOrderDetailData(data);
    if (parsed?.awb_number) {
      mergePanelOrderMaps(panelById, [
        {
          shipmozo_order_id: normalizeShipmozoOrderIdRef(parsed.shipmozo_order_id ?? id),
          reference_id: customerRef,
          awb_number: parsed.awb_number,
          courier: parsed.courier,
          status: parsed.status,
          lookup_id: id,
        },
      ]);
    }
  }

  const panelOrders = [...panelById.values()];
  const duplicateCount = panelOrders.length > 1 ? panelOrders.length - 1 : 0;

  const best = pickBestPanelOrder(panelOrders);
  if (best?.awb_number) {
    return {
      ok: true,
      awb_number: best.awb_number,
      courier: best.courier,
      status: best.status,
      shipmozo_order_id: best.shipmozo_order_id,
      lookup_id: best.lookup_id,
      panelOrders,
      duplicateCount: Math.max(0, panelOrders.length - 1),
      triedIds: [...tried],
    };
  }

  if (best) {
    return {
      ok: false,
      error: "no_awb_on_shipmozo_order",
      shipmozo_order_id: best.shipmozo_order_id,
      lookup_id: best.lookup_id,
      status: best.status,
      panelOrders,
      duplicateCount: Math.max(0, panelOrders.length - 1),
      triedIds: [...tried],
    };
  }

  return {
    ok: false,
    error: lastError,
    panelOrders,
    duplicateCount: Math.max(0, panelOrders.length - 1),
    triedIds: [...tried],
  };
}

export function shipmozoPanelOrderIdsFromMetadata(metadata?: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const normalized = normalizeShipmozoOrderIdRef(String(value ?? ""));
    if (normalized) ids.add(normalized);
  };

  if (!metadata) return [];
  add(metadata.shipmozo_order_id);
  if (Array.isArray(metadata.shipmozo_order_ids)) {
    for (const id of metadata.shipmozo_order_ids) add(id);
  }

  const discovery = metadata.lastAwbDiscovery;
  if (discovery && typeof discovery === "object" && Array.isArray((discovery as Record<string, unknown>).panelOrders)) {
    for (const row of (discovery as Record<string, unknown>).panelOrders as unknown[]) {
      if (row && typeof row === "object") {
        add((row as Record<string, unknown>).shipmozo_order_id);
      }
    }
  }

  return [...ids];
}

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

/** ShipMozo order identity when panel has the order but AWB is not assigned yet. */
function parseShipmozoPanelOrder(
  data: unknown
): { shipmozo_order_id?: string; reference_id?: string; status?: string } | null {
  if (data == null) return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const parsed = parseShipmozoPanelOrder(item);
      if (parsed) return parsed;
    }
    return null;
  }

  if (typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const shipmozo_order_id = readStringField(d, ["order_id", "id"]);
  const reference_id = readStringField(d, ["reference_id", "order_ref", "customer_order_id"]);
  const status = readStringField(d, STATUS_FIELD_KEYS) || undefined;

  if (shipmozo_order_id || reference_id) {
    return {
      shipmozo_order_id: shipmozo_order_id || reference_id,
      reference_id: reference_id || undefined,
      status,
    };
  }

  for (const value of Object.values(d)) {
    if (value && typeof value === "object") {
      const nested = parseShipmozoPanelOrder(value);
      if (nested) return nested;
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
    for (const id of shipmozoPanelOrderIdsFromMetadata(input.metadata)) add(id);

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
  lookupIds: string[],
  customerRef?: string
): Promise<ShipmozoOrderDetailResult> {
  const ref =
    customerRef ??
    lookupIds.find((id) => /^IRX/i.test(normalizeShipmozoOrderIdRef(id))) ??
    lookupIds[0] ??
    "";
  return discoverShipmozoOrdersForRef({ lookupIds, customerRef: ref });
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

/** Log which ShipMozo env pieces are missing (safe for production logs). */
export function shipmozoConfigDiagnostics(): {
  configured: boolean;
  hasPublicKey: boolean;
  hasPrivateKey: boolean;
  hasWarehouse: boolean;
} {
  const hasPublicKey = Boolean((process.env.SHIPMOZO_PUBLIC_KEY ?? "").trim());
  const hasPrivateKey = Boolean((process.env.SHIPMOZO_PRIVATE_KEY ?? "").trim());
  const hasWarehouse = Boolean(
    (process.env.SHIPMOZO_WAREHOUSE_ID ?? "").trim() || (process.env.SHIPMOZO_WAREHOUSE_TITLE ?? "").trim()
  );
  return {
    configured: hasPublicKey && hasPrivateKey && hasWarehouse,
    hasPublicKey,
    hasPrivateKey,
    hasWarehouse,
  };
}

export async function runShipmozoPendingOrderPush() {
  const diag = shipmozoConfigDiagnostics();
  if (!diag.configured) {
    console.warn("[shipmozo-push-sync] skipped — missing env", diag);
    return { scanned: 0, pushed: 0, failed: 0, skipped: 0, notConfigured: true as const };
  }

  const lookbackDays = Math.max(1, Number(process.env.SHIPMOZO_PUSH_LOOKBACK_DAYS ?? 60) || 60);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const batchSize = Math.max(
    1,
    Math.min(50, Number(process.env.SHIPMOZO_PUSH_BATCH_SIZE ?? 25) || 25)
  );

  const orders = await prisma.orders.findMany({
    where: {
      payment_status: "SUCCEEDED",
      created_at: { gte: since },
      OR: [{ awb_number: null }, { awb_number: "" }],
    },
    orderBy: { created_at: "asc" },
    take: batchSize,
    select: {
      id: true,
      shipments: { select: { tracking_number: true, metadata: true } },
    },
  });

  let pushed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of orders) {
    if ((row.shipments?.tracking_number ?? "").trim()) {
      skipped += 1;
      continue;
    }
    if (priorPushSucceeded(row.shipments?.metadata)) {
      skipped += 1;
      continue;
    }

    const hadPriorAttempt = Boolean(row.shipments?.metadata);
    const result = await bookShipmozoShipmentForOrder(row.id, { force: false });
    if (result.ok) pushed += 1;
    else if (hadPriorAttempt && result.reason === "order_already_in_shipmozo_panel") skipped += 1;
    else failed += 1;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (pushed > 0 || failed > 0) {
    console.info(`[shipmozo-push-sync] scanned=${orders.length} pushed=${pushed} failed=${failed} skipped=${skipped}`);
  }

  return { scanned: orders.length, pushed, failed, skipped, notConfigured: false as const };
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

async function resolveWarehouseId(orderId?: string): Promise<string | null> {
  const explicitId = (process.env.SHIPMOZO_WAREHOUSE_ID ?? "").trim();
  const title = (process.env.SHIPMOZO_WAREHOUSE_TITLE ?? "").trim();

  if (explicitId) {
    const list = await fetchShipmozoWarehouseList();
    const found = list.warehouses.some((w) => w.id === explicitId);
    const validation: ShipmozoWarehouseValidation = {
      configuredId: explicitId,
      configuredTitle: title || null,
      foundInApi: found,
      validWarehouses: list.warehouses,
      validatedAt: new Date().toISOString(),
    };

    if (list.apiOk && !found) {
      const validList = list.warehouses
        .map((w) => `${w.id} (${w.address_title || "untitled"})`)
        .join(", ");
      console.warn(
        `[ShipMozo] WARN: SHIPMOZO_WAREHOUSE_ID "${explicitId}" not found in /get-warehouses response` +
          (validList ? `. Valid warehouses: ${validList}` : ". No warehouses returned.")
      );
    }

    if (orderId && list.apiOk && !found) {
      await appendShipmozoMetadata(orderId, { warehouseValidation: validation });
    }

    return explicitId;
  }

  if (!title) return null;
  const list = await fetchShipmozoWarehouseList();
  if (!list.apiOk) return null;
  const match = list.warehouses.find((it) => it.address_title === title);
  return match?.id ?? null;
}

export async function runShipmozoConfigCheck() {
  const publicKey = (process.env.SHIPMOZO_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.SHIPMOZO_PRIVATE_KEY ?? "").trim();
  const warehouseId = (process.env.SHIPMOZO_WAREHOUSE_ID ?? "").trim();
  const warehouseTitle = (process.env.SHIPMOZO_WAREHOUSE_TITLE ?? "").trim();

  const infoRes = await callShipmozo("/info", "GET");
  const warehouseList = await fetchShipmozoWarehouseList({ forceRefresh: true });

  return {
    keys: {
      publicKeySet: Boolean(publicKey),
      publicKeyMasked: maskShipmozoSecret(publicKey),
      privateKeySet: Boolean(privateKey),
      privateKeyMasked: maskShipmozoSecret(privateKey),
    },
    warehouse: {
      configuredId: warehouseId || null,
      configuredTitle: warehouseTitle || null,
      configuredIdFoundInApi: warehouseId
        ? warehouseList.warehouses.some((w) => w.id === warehouseId)
        : null,
    },
    info: {
      ok: infoRes.ok,
      status: infoRes.status,
      response: infoRes.parsed,
      raw: infoRes.raw.slice(0, 500),
    },
    warehouses: {
      ok: warehouseList.apiOk,
      list: warehouseList.warehouses,
    },
  };
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

export async function applyDiscoveredShipmozoAwb(
  orderId: string,
  discovery: ShipmozoDiscoveryResult,
  customerRef: string
): Promise<boolean> {
  if (!discovery.ok || !discovery.awb_number) return false;

  const awbFromPanel = discovery.awb_number;
  const courierFromPanel = discovery.courier ?? "Shipmozo";
  const panelIds = discovery.panelOrders.map((row) => row.shipmozo_order_id);

  await prisma.shipments.updateMany({
    where: { order_id: orderId },
    data: {
      carrier: courierFromPanel,
      tracking_number: awbFromPanel,
      status: "CREATED",
    },
  });
  await prisma.orders.update({
    where: { id: orderId },
    data: {
      awb_number: awbFromPanel,
      carrier: courierFromPanel,
      shipment_status: "PICKUP_GENERATED",
      shipment_updated_at: new Date(),
    },
  });
  await appendShipmozoMetadata(orderId, {
    status: "booked",
    awb_number: awbFromPanel,
    courier: courierFromPanel,
    reference_id: customerRef,
    reason: "awb_synced_from_shipmozo_panel",
    shipmozo_order_id: discovery.shipmozo_order_id,
    shipmozo_order_ids: panelIds,
    duplicatePanelOrders: discovery.duplicateCount,
    lastAwbDiscovery: {
      ok: true,
      awb: awbFromPanel,
      error: null,
      triedIds: discovery.triedIds,
      lookup_id: discovery.lookup_id ?? null,
      panelOrders: discovery.panelOrders,
      duplicateCount: discovery.duplicateCount,
      refreshedAt: new Date().toISOString(),
    },
  });
  try {
    await sendPickupEmail(orderId);
  } catch (emailErr) {
    console.error("[shipmozo-booking] pickup email failed", { orderId, emailErr });
  }
  return true;
}

async function recordShipmozoPanelDiscovery(
  orderId: string,
  customerRef: string,
  discovery: ShipmozoDiscoveryResult,
  extra?: Record<string, unknown>
) {
  const panelIds = discovery.panelOrders.map((row) => row.shipmozo_order_id);
  const bestId = discovery.shipmozo_order_id ?? panelIds[0];
  await appendShipmozoMetadata(orderId, {
    reference_id: customerRef,
    ...(bestId && bestId !== customerRef ? { shipmozo_order_id: bestId } : {}),
    ...(panelIds.length > 0 ? { shipmozo_order_ids: panelIds } : {}),
    duplicatePanelOrders: discovery.duplicateCount,
    lastAwbDiscovery: {
      ok: discovery.ok,
      awb: discovery.awb_number ?? null,
      error: discovery.error ?? null,
      triedIds: discovery.triedIds,
      lookup_id: discovery.lookup_id ?? null,
      panelOrders: discovery.panelOrders,
      duplicateCount: discovery.duplicateCount,
      refreshedAt: new Date().toISOString(),
    },
    ...extra,
  });
}

export async function bookShipmozoShipmentForOrder(
  orderId: string,
  options?: { force?: boolean }
): Promise<ShipmozoBookingResult> {
  if (!isShipmozoConfigured()) {
    await appendShipmozoMetadata(orderId, {
      status: "error",
      reason: "shipmozo_not_configured",
      message: "Set SHIPMOZO_PUBLIC_KEY, SHIPMOZO_PRIVATE_KEY, and warehouse env vars.",
    });
    return {
      ok: false,
      reason: "shipmozo_not_configured",
      error: "ShipMozo is not configured on this server",
    };
  }

  const existing = await prisma.shipments.findUnique({
    where: { order_id: orderId },
    select: { tracking_number: true, metadata: true },
  });
  if (existing?.tracking_number) {
    return { ok: true, skipped: true, reason: "already_has_tracking" };
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      total_amount: true,
      payment_status: true,
      customers: { select: { email: true } },
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
    return { ok: false, reason: "missing_shipping_address", error: "Shipping address missing" };
  }
  if (order.payment_status !== "SUCCEEDED") {
    return { ok: false, reason: "not_paid", error: "Order is not paid" };
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
    return { ok: false, reason: "invalid_contact_or_pin", error: "Invalid customer phone or PIN code" };
  }

  const packageDetails = computeOrderPackageDetails(
    (order.order_items ?? []).map((it) => ({
      quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
      weightG: it.products?.weight_g ?? null,
    }))
  );

  const lineItems = (order.order_items ?? []).map((it) => ({
    name: String(it.product_name ?? "Item").slice(0, 200),
    sku_number: "",
    quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
    discount: "",
    hsn: productHsnForShipmozo(it.products ?? {}),
    unit_price: Number(it.unit_price ?? 0),
    product_category: "Other",
  }));

  const customerRef = normalizeShipmozoOrderIdRef(shipmozoOrderRef(order));
  const priorMeta =
    existing?.metadata && typeof existing.metadata === "object"
      ? ((existing.metadata as Record<string, unknown>).shipmozo as Record<string, unknown> | undefined)
      : undefined;
  const alreadyPushed = !options?.force && priorPushSucceeded(existing?.metadata);

  let createdOrderId = customerRef;
  if (priorMeta?.shipmozo_order_id) {
    createdOrderId = normalizeShipmozoOrderIdRef(String(priorMeta.shipmozo_order_id));
  } else if (priorMeta?.reference_id) {
    createdOrderId = normalizeShipmozoOrderIdRef(String(priorMeta.reference_id));
  }

  const lookupIds = collectShipmozoLookupIds({ customerRef, metadata: priorMeta });
  let skipPushOrder = alreadyPushed;

  const discovery = await discoverShipmozoOrdersForRef({
    lookupIds: lookupIds.length > 0 ? lookupIds : [customerRef, createdOrderId],
    customerRef,
  });

  if (discovery.ok && discovery.awb_number) {
    await applyDiscoveredShipmozoAwb(orderId, discovery, customerRef);
    return { ok: true, reason: "booked" };
  }

  if (discovery.panelOrders.length > 0) {
    skipPushOrder = true;
    createdOrderId = normalizeShipmozoOrderIdRef(
      discovery.shipmozo_order_id ?? discovery.panelOrders[0]?.shipmozo_order_id ?? createdOrderId
    );
    await recordShipmozoPanelDiscovery(orderId, customerRef, discovery, {
      status: "awaiting_shipment",
      reason: "order_already_in_shipmozo_panel",
      message:
        discovery.duplicateCount > 0
          ? `${discovery.panelOrders.length} ShipMozo orders found for ${customerRef}. Assign a courier on the scheduled shipment or cancel duplicates in the panel.`
          : "Order is in ShipMozo — assign a courier in the panel to generate AWB.",
    });
  }

  if (!skipPushOrder) {
    const warehouseId = await resolveWarehouseId(orderId);
    if (!warehouseId) {
      await appendShipmozoMetadata(orderId, {
        status: "error",
        reason: "warehouse_not_resolved",
        message: "Could not resolve Shipmozo warehouse_id from SHIPMOZO_WAREHOUSE_ID/SHIPMOZO_WAREHOUSE_TITLE.",
      });
      return { ok: false, reason: "warehouse_not_resolved", error: "ShipMozo warehouse not configured" };
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
    const pushMessage = shipmozoPushErrorMessage(push.parsed, push.raw);
    const pushedAt = new Date().toISOString();
    await appendShipmozoMetadata(orderId, {
      pushOrder: {
        ok: push.ok,
        status: push.status,
        response: push.parsed,
        rawResponse: push.raw,
        message: push.ok ? null : pushMessage,
        pushedAt,
        sentPayload: scrubPushPayloadForMetadata(pushPayload),
      },
    });

    if (!push.ok) {
      const existingInPanel = await discoverShipmozoOrdersForRef({
        lookupIds: [customerRef, createdOrderId],
        customerRef,
      });
      if (existingInPanel.panelOrders.length > 0) {
        if (existingInPanel.ok && existingInPanel.awb_number) {
          await applyDiscoveredShipmozoAwb(orderId, existingInPanel, customerRef);
          return { ok: true, reason: "booked" };
        }
        createdOrderId = normalizeShipmozoOrderIdRef(
          existingInPanel.shipmozo_order_id ??
            existingInPanel.panelOrders[0]?.shipmozo_order_id ??
            customerRef
        );
        await recordShipmozoPanelDiscovery(orderId, customerRef, existingInPanel, {
          status: "awaiting_shipment",
          reason: "order_already_in_shipmozo_panel",
          message: "Push returned an error but order exists in ShipMozo — assign courier in panel.",
        });
        skipPushOrder = true;
      } else {
        console.error("[shipmozo-booking] push-order failed", { orderId, message: pushMessage, status: push.status });
        await appendShipmozoMetadata(orderId, {
          status: "error",
          reason: "push_order_failed",
          message: pushMessage,
        });
        return { ok: false, reason: "push_order_failed", error: pushMessage };
      }
    } else {
      createdOrderId = normalizeShipmozoOrderIdRef(
        typeof push.parsed === "object" && push.parsed && "data" in push.parsed
          ? String((push.parsed as ShipmozoResponse).data?.order_id ?? pushPayload.order_id)
          : String(pushPayload.order_id)
      );
      await appendShipmozoMetadata(orderId, {
        reference_id: customerRef,
        ...(createdOrderId !== customerRef ? { shipmozo_order_id: createdOrderId } : {}),
        shipmozo_order_ids: [createdOrderId],
        status: "awaiting_shipment",
      });
    }
  }

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
    const detail = await fetchShipmozoOrderDetailWithCandidates(
      collectShipmozoLookupIds({
        customerRef,
        metadata: {
          reference_id: customerRef,
          shipmozo_order_id: createdOrderId,
          shipmozo_order_ids: [createdOrderId],
        },
      }),
      customerRef
    );
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

  return awb
    ? { ok: true, reason: "booked" }
    : { ok: true, reason: "pushed_awaiting_awb", error: "Order pushed to ShipMozo — assign courier in the panel" };
}

