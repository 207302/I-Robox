"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";
import { AdminProductThumbnail } from "@/components/admin/AdminProductThumbnail";
import { formatPrice } from "@/utils/formatePrice";
import {
  SHIPMOZO_TRACKING_STEPS,
  SHIPMOZO_TRACKING_STEP_LABELS,
  type ShipmozoTrackingStatus,
} from "@/lib/shipping/shipmozoTrackingConstants";

function ShipmozoShipmentNote({ shipment }: { shipment: any }) {
  const d = shipment?.shipmozo;
  const hasCarrier = Boolean((shipment?.carrier ?? "").trim());
  const hasTracking = Boolean((shipment?.tracking_number ?? "").trim());
  if (hasCarrier && hasTracking) return null;

  let body: ReactNode;
  if (d && typeof d === "object") {
    const status = "status" in d ? String((d as Record<string, unknown>).status ?? "") : "";
    const reason = "reason" in d ? String((d as Record<string, unknown>).reason ?? "") : "";
    const message = "message" in d ? String((d as Record<string, unknown>).message ?? "") : "";
    const rmk = "rmk" in d ? String((d as Record<string, unknown>).rmk ?? "") : "";
    const lastRequestAt =
      "diagnostics" in d &&
      (d as Record<string, unknown>).diagnostics &&
      typeof (d as Record<string, unknown>).diagnostics === "object" &&
      "lastRequestAt" in ((d as Record<string, unknown>).diagnostics as Record<string, unknown>)
        ? String(((d as Record<string, unknown>).diagnostics as Record<string, unknown>).lastRequestAt ?? "")
        : "";
    const lastDiscovery =
      d.lastAwbDiscovery && typeof d.lastAwbDiscovery === "object"
        ? (d.lastAwbDiscovery as Record<string, unknown>)
        : null;
    const discoveryError = lastDiscovery ? String(lastDiscovery.error ?? "") : "";
    const duplicateCount = lastDiscovery ? Number(lastDiscovery.duplicateCount ?? d.duplicatePanelOrders ?? 0) : 0;
    const panelOrders =
      lastDiscovery && Array.isArray(lastDiscovery.panelOrders)
        ? (lastDiscovery.panelOrders as Array<Record<string, unknown>>)
        : [];
    const triedIds =
      lastDiscovery && Array.isArray(lastDiscovery.triedIds)
        ? lastDiscovery.triedIds.map((id) => String(id)).join(", ")
        : "";
    const pushOrder =
      d.pushOrder && typeof d.pushOrder === "object" ? (d.pushOrder as Record<string, unknown>) : null;
    const pushMessage = pushOrder?.message ? String(pushOrder.message) : "";
    const pushRawResponse = pushOrder?.rawResponse ? String(pushOrder.rawResponse) : "";
    const pushSentPayload =
      pushOrder?.sentPayload && typeof pushOrder.sentPayload === "object"
        ? JSON.stringify(pushOrder.sentPayload)
        : "";
    const pushPushedAt = pushOrder?.pushedAt ? String(pushOrder.pushedAt) : "";
    const warehouseValidation =
      d.warehouseValidation && typeof d.warehouseValidation === "object"
        ? (d.warehouseValidation as Record<string, unknown>)
        : null;
    const warehouseWarn =
      warehouseValidation?.foundInApi === false && warehouseValidation?.configuredId
        ? `Warehouse ID ${warehouseValidation.configuredId} not found in ShipMozo API`
        : "";
    const validWarehouses =
      warehouseValidation?.foundInApi === false && Array.isArray(warehouseValidation.validWarehouses)
        ? (warehouseValidation.validWarehouses as Array<Record<string, unknown>>)
            .map((w) => `${w.id} (${w.address_title ?? ""})`)
            .join(", ")
        : "";
    const pushResponse =
      pushOrder?.response && typeof pushOrder.response === "object"
        ? JSON.stringify(pushOrder.response)
        : pushOrder?.response
          ? String(pushOrder.response)
          : "";
    const pushOk = pushOrder?.ok;
    const parts = [
      status && `Status: ${status}`,
      reason && `Reason: ${reason}`,
      reason === "order_already_in_shipmozo_panel" &&
        "Order is already in ShipMozo — assign a courier in the panel to generate AWB",
      message && message,
      pushOk === false && reason === "shipmozo_not_configured" &&
        "ShipMozo env vars missing on server (Hostinger → Environment)",
      pushOk === false && reason === "warehouse_not_resolved" &&
        "ShipMozo warehouse not found — set SHIPMOZO_WAREHOUSE_ID or SHIPMOZO_WAREHOUSE_TITLE",
      pushOk === false && pushMessage && `Push failed: ${pushMessage}`,
      pushOk === false && pushRawResponse && `ShipMozo raw response: ${pushRawResponse}`,
      pushOk === false && pushResponse && !pushRawResponse && `ShipMozo response: ${pushResponse}`,
      pushOk === false && pushSentPayload && `Sent payload: ${pushSentPayload}`,
      pushPushedAt && `Last push attempt: ${pushPushedAt}`,
      warehouseWarn && warehouseWarn,
      validWarehouses && `Valid ShipMozo warehouses: ${validWarehouses}`,
      pushOk === false && !pushMessage && !reason && "Push failed: check ShipMozo API keys and warehouse env vars",
      discoveryError && `AWB sync: ${discoveryError}`,
      duplicateCount > 0 &&
        `${panelOrders.length} ShipMozo order(s) found for this ref (${duplicateCount} duplicate)`,
      panelOrders.length > 0 &&
        `Panel orders: ${panelOrders
          .map((row) => {
            const id = String(row.shipmozo_order_id ?? "");
            const awb = String(row.awb_number ?? "").trim();
            const status = String(row.status ?? "").trim();
            return awb ? `${id} (AWB ${awb})` : status ? `${id} (${status})` : id;
          })
          .join("; ")}`,
      triedIds && `Tried ShipMozo ids: ${triedIds}`,
      rmk && `Shipmozo: ${rmk}`,
      lastRequestAt && `Last request: ${lastRequestAt}`,
    ].filter(Boolean);
    body =
      parts.length > 0 ? (
        <ul className="list-disc pl-4 space-y-0.5">
          {parts.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      ) : (
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(d, null, 2)}</pre>
      );
  } else {
    body = (
      <p>
        No shipment diagnostic was saved for this order. Set Shipmozo env vars:{" "}
        <code className="rounded bg-gray-2 px-1">SHIPMOZO_PUBLIC_KEY</code>,{" "}
        <code className="rounded bg-gray-2 px-1">SHIPMOZO_PRIVATE_KEY</code>, and either{" "}
        <code className="rounded bg-gray-2 px-1">SHIPMOZO_WAREHOUSE_ID</code> or{" "}
        <code className="rounded bg-gray-2 px-1">SHIPMOZO_WAREHOUSE_TITLE</code>
        . Redeploy/restart, then place a new test order (existing orders are not re-booked automatically).
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-dark">
      <div className="font-medium text-dark mb-1">Why carrier / tracking may be empty</div>
      {body}
    </div>
  );
}

type AdminOrderDetailClientProps = {
  canDelete?: boolean;
};

function CopyableTransactionId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="flex items-start gap-2">
      <code className="font-mono text-xs break-all text-dark">{value}</code>
      <button
        type="button"
        onClick={() => void copy()}
        title={copied ? "Copied!" : "Copy to clipboard"}
        className="relative shrink-0 rounded border border-gray-3 bg-gray-1 px-2 py-0.5 text-xs font-medium text-meta-3 hover:bg-gray-2 transition"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function AdminOrderDetailClient({ canDelete = false }: AdminOrderDetailClientProps) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncingShipment, setSyncingShipment] = useState(false);
  const [pushingShipmozo, setPushingShipmozo] = useState(false);
  const [refreshingShipmozo, setRefreshingShipmozo] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("PENDING");

  function resolveStatusSelection(order: { status?: string; paymentStatus?: string }): string {
    if (order.paymentStatus === "PARTIALLY_REFUNDED") return "PARTIALLY_REFUNDED";
    if (order.paymentStatus === "REFUNDED") return "REFUNDED";
    return order.status ?? "PENDING";
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOrder(options?: { silent?: boolean }) {
      if (!options?.silent) setSyncingShipment(true);
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        const json = await res.json().catch(() => null);
        if (cancelled || !res.ok || !json) return;
        setData((prev: any) => {
          if (!prev || !options?.silent) {
            setSelectedStatus(resolveStatusSelection(json));
            return json;
          }
          return {
            ...prev,
            shipment: {
              ...prev.shipment,
              trackingStatus: json.shipment?.trackingStatus ?? prev.shipment?.trackingStatus,
              carrier: json.shipment?.carrier ?? prev.shipment?.carrier,
              tracking_number: json.shipment?.tracking_number ?? prev.shipment?.tracking_number,
              shipment_updated_at:
                json.shipment?.shipment_updated_at ?? prev.shipment?.shipment_updated_at,
              shipmozo: json.shipment?.shipmozo ?? prev.shipment?.shipmozo,
            },
          };
        });
      } finally {
        if (!cancelled && !options?.silent) setSyncingShipment(false);
      }
    }

    void loadOrder();
    const timer = window.setInterval(() => {
      void loadOrder({ silent: true });
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  const statusOptions = useMemo(
    () =>
      [
        { value: "PENDING", label: "Pending" },
        { value: "PAYMENT_FAILED", label: "Payment failed" },
        { value: "CONFIRMED", label: "Confirmed" },
        { value: "CANCELLED", label: "Cancelled" },
        { value: "SHIPPED", label: "Shipped" },
        { value: "DELIVERED", label: "Delivered" },
        { value: "RETURN_REQUESTED", label: "Return requested" },
        { value: "RETURN_APPROVED", label: "Return approved" },
        { value: "RETURN_REJECTED", label: "Return rejected" },
        { value: "REFUNDED", label: "Refunded" },
        { value: "PARTIALLY_REFUNDED", label: "Partial Refund" },
      ] as const,
    []
  );

  const shipmentStatusOptions = useMemo(
    () => SHIPMOZO_TRACKING_STEPS as readonly ShipmozoTrackingStatus[],
    []
  );

  const currentTrackingStatus: ShipmozoTrackingStatus =
    data?.shipment?.trackingStatus &&
    SHIPMOZO_TRACKING_STEPS.includes(data.shipment.trackingStatus as ShipmozoTrackingStatus)
      ? (data.shipment.trackingStatus as ShipmozoTrackingStatus)
      : "ORDER_PLACED";

  async function refreshFromShipmozo() {
    setRefreshingShipmozo(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipmozo-refresh`, { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Could not refresh from ShipMozo");
      toast.success(out?.message || "Refreshed from ShipMozo");
      const refresh = await fetch(`/api/admin/orders/${id}`);
      const json = await refresh.json().catch(() => null);
      if (refresh.ok && json) setData(json);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "ShipMozo refresh failed");
    } finally {
      setRefreshingShipmozo(false);
    }
  }

  async function pushToShipmozo() {
    setPushingShipmozo(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipmozo-push`, { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Could not push to ShipMozo");
      toast.success(out?.message || "Pushed to ShipMozo");
      const refresh = await fetch(`/api/admin/orders/${id}`);
      const json = await refresh.json().catch(() => null);
      if (refresh.ok && json) setData(json);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "ShipMozo push failed");
    } finally {
      setPushingShipmozo(false);
    }
  }

  async function save() {
    if (selectedStatus === "PARTIALLY_REFUNDED" || selectedStatus === "REFUNDED") {
      const label = selectedStatus === "PARTIALLY_REFUNDED" ? "Partial Refund" : "Refunded";
      const confirmed = window.confirm(
        `This will update the payment status to ${label} and email the customer. This cannot be undone. Continue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          shipment: {
            ...data.shipment,
            trackingStatus: data.shipment?.trackingStatus,
          },
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) throw new Error(out?.error || "Failed to save");
      if (res.status === 207 && typeof out.emailError === "string") {
        toast(out.emailError, { duration: 6000, icon: "⚠️" });
      } else {
        toast.success("Order updated");
      }
      const refresh = await fetch(`/api/admin/orders/${id}`);
      const json = await refresh.json().catch(() => null);
      if (refresh.ok && json) {
        setData(json);
        setSelectedStatus(resolveStatusSelection(json));
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      `Permanently delete order ${data?.orderId ?? data?.orderNumber ?? id}? Reserved or sold stock will be restored where possible. This cannot be undone.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetchAdminWithRetry(`/api/admin/orders/${id}`, { method: "DELETE" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Delete failed");
      toast.success("Order deleted");
      router.push("/admin/orders");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (!data) return <div className="text-sm text-meta-3">Loading…</div>;

  const isRazorpayPayment = (data.paymentMethod ?? "").toLowerCase().includes("razorpay");
  const isRefunded =
    data.paymentStatus === "REFUNDED" ||
    data.paymentStatus === "PARTIALLY_REFUNDED" ||
    Boolean(data.refundTransactionId);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link href="/admin/orders" className="text-sm text-blue hover:underline">
            ← Back to orders
          </Link>
          <h1 className="text-2xl font-semibold text-dark">Order</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/admin/orders/${id}/invoice/download`}
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition"
          >
            Download invoice
          </a>
          {canDelete ? (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={() => void handleDelete()}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete order"}
            </button>
          ) : null}
          <button
            disabled={saving || deleting}
            onClick={save}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Order details</h2>
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-meta-3">Order ID</dt>
            <dd className="mt-0.5 font-semibold text-dark font-mono tracking-wide">
              {data.orderId ?? data.orderNumber ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-meta-3">Order status</dt>
            <dd className="mt-0.5 font-medium text-dark">{data.status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-meta-3">Customer name</dt>
            <dd className="mt-0.5 font-medium text-dark">{data.customer?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-meta-3">Phone</dt>
            <dd className="mt-0.5 font-medium text-dark">{data.customer?.phone ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2 grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div>
                <dt className="text-meta-3">Email</dt>
                <dd className="mt-0.5 font-medium text-dark break-all">
                  {data.customer?.email ?? "Guest"}
                </dd>
              </div>
              <div>
                <dt className="text-meta-3">Address</dt>
                <dd className="mt-0.5 font-medium text-dark max-w-xs break-words">
                  {data.shippingAddress ? (
                    <span className="block space-y-0.5">
                      <span className="block">
                        {data.shippingAddress.line1}
                        {data.shippingAddress.line2 ? `, ${data.shippingAddress.line2}` : ""}
                      </span>
                      <span className="block text-meta-3">
                        {data.shippingAddress.city}, {data.shippingAddress.state}{" "}
                        {data.shippingAddress.postalCode}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-meta-3">Gift wrapping</dt>
                <dd className="mt-0.5 font-medium text-dark">
                  {data.isGift ? "Yes" : "No"}
                  {data.isGift && data.giftMessage ? (
                    <span className="block text-meta-3 font-normal mt-1">
                      Message: {data.giftMessage}
                    </span>
                  ) : null}
                </dd>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <dt className="text-meta-3">Payment</dt>
                <dd className="mt-0.5 font-medium text-dark">{data.paymentMethod ?? "—"}</dd>
                {isRazorpayPayment && data.paymentStatus === "SUCCEEDED" ? (
                  <p className="mt-2 text-sm font-medium text-green-700">Razorpay payment succeeded</p>
                ) : null}
              </div>
              <div>
                <dt className="text-meta-3">Payment status</dt>
                <dd className="mt-0.5 font-medium text-dark">{data.paymentStatus ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-meta-3">Transaction ID</dt>
                <dd className="mt-0.5 font-medium text-dark">
                  {data.razorpayPaymentId || data.refundTransactionId ? (
                    <div className="space-y-2">
                      {data.razorpayPaymentId ? (
                        <div>
                          <div className="text-xs text-meta-3 font-normal mb-1">Payment</div>
                          <CopyableTransactionId value={data.razorpayPaymentId} />
                        </div>
                      ) : null}
                      {data.refundTransactionId ? (
                        <div>
                          <div className="text-xs text-meta-3 font-normal mb-1">Refund</div>
                          <CopyableTransactionId value={data.refundTransactionId} />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-meta-3 font-normal">—</span>
                  )}
                </dd>
              </div>
              {isRefunded && typeof data.refundedAmount === "number" ? (
                <div>
                  <dt className="text-meta-3">Refunded amount</dt>
                  <dd className="mt-0.5 font-medium text-dark">
                    {formatPrice(data.refundedAmount / 100)}
                  </dd>
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <dt className="text-meta-3">Total</dt>
            <dd className="mt-0.5 text-lg font-semibold text-dark">
              {formatPrice(Number(data.totalAmount ?? 0))}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Update status</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Order status</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          >
            {statusOptions.map((s) => (
              <option
                key={s.value}
                value={s.value}
                disabled={data.paymentStatus === "REFUNDED" && s.value === "PARTIALLY_REFUNDED"}
              >
                {s.label}
              </option>
            ))}
          </select>
          {data.paymentStatus === "REFUNDED" ? (
            <p className="mt-1.5 text-xs text-amber-700">
              This order has already been fully refunded.
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-meta-3">
            &ldquo;Partial Refund&rdquo; and &ldquo;Refunded&rdquo; update payment status and email the
            customer. Other options update fulfilment status only.
          </p>
        </label>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-dark">Shipment</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={refreshingShipmozo || pushingShipmozo || saving}
              onClick={() => void refreshFromShipmozo()}
              className="rounded-lg border border-gray-3 bg-white px-3 py-1.5 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
            >
              {refreshingShipmozo ? "Refreshing…" : "Refresh from ShipMozo"}
            </button>
            <button
              type="button"
              disabled={pushingShipmozo || refreshingShipmozo || saving}
              onClick={() => void pushToShipmozo()}
              className="rounded-lg border border-blue/30 bg-blue/5 px-3 py-1.5 text-sm font-medium text-blue hover:bg-blue/10 transition disabled:opacity-60"
            >
              {pushingShipmozo ? "Pushing…" : "Push to ShipMozo"}
            </button>
            {syncingShipment ? (
              <span className="text-xs text-meta-3">Syncing from ShipMozo…</span>
            ) : data.shipment?.shipment_updated_at ? (
              <span className="text-xs text-meta-3">
                Last updated{" "}
                {new Date(data.shipment.shipment_updated_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            ) : null}
          </div>
        </div>
        <label className="block max-w-md">
          <span className="mb-1 block text-sm font-medium text-dark">Shipment status</span>
          <select
            value={currentTrackingStatus}
            onChange={(e) =>
              setData((d: any) => ({
                ...d,
                shipment: { ...d.shipment, trackingStatus: e.target.value },
              }))
            }
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          >
            {shipmentStatusOptions.map((s) => (
              <option key={s} value={s}>
                {SHIPMOZO_TRACKING_STEP_LABELS[s]}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-meta-3">
            Matches the customer tracking timeline. Refreshes from ShipMozo when you open this page
            and every minute while it stays open.
          </p>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Carrier</span>
            <input
              value={data.shipment?.carrier ?? ""}
              onChange={(e) =>
                setData((d: any) => ({ ...d, shipment: { ...d.shipment, carrier: e.target.value } }))
              }
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Tracking number</span>
            <input
              value={data.shipment?.tracking_number ?? ""}
              onChange={(e) =>
                setData((d: any) => ({
                  ...d,
                  shipment: { ...d.shipment, tracking_number: e.target.value },
                }))
              }
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>
        <ShipmozoShipmentNote shipment={data.shipment} />
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-dark">Items</h2>
        <ul className="space-y-3 text-sm text-dark">
          {data.items?.map((it: any) => {
            const productHref = it.product_slug ? `/shop/${it.product_slug}` : null;
            const thumb = (
              <AdminProductThumbnail
                url={it.product_image_url}
                alt={it.product_name}
                size={48}
              />
            );
            return (
              <li
                key={it.id}
                className="flex items-center justify-between gap-4 border-b border-gray-3 pb-3 last:border-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {productHref ? (
                    <Link
                      href={productHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={it.product_name}
                      className="shrink-0 rounded-lg border border-transparent p-0.5 transition hover:border-gray-3"
                    >
                      {thumb}
                    </Link>
                  ) : (
                    <div className="shrink-0">{thumb}</div>
                  )}
                  <div className="min-w-0">
                    {productHref ? (
                      <Link
                        href={productHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-dark hover:text-blue hover:underline"
                      >
                        {it.product_name}
                      </Link>
                    ) : (
                      <div className="truncate font-medium">{it.product_name}</div>
                    )}
                    <div className="text-xs text-meta-3 mt-0.5">
                      {formatPrice(Number(it.unit_price ?? 0))} × {it.quantity}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 font-medium">
                  {formatPrice(Number(it.subtotal_amount ?? 0))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
