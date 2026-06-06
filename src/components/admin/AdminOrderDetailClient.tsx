"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";
import { formatPrice } from "@/utils/formatePrice";

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
    const parts = [
      status && `Status: ${status}`,
      reason && `Reason: ${reason}`,
      message && message,
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

export function AdminOrderDetailClient({ canDelete = false }: AdminOrderDetailClientProps) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/orders/${id}`);
      const json = await res.json().catch(() => null);
      setData(json);
    })();
  }, [id]);

  const statusOptions = useMemo(
    () => [
      "PENDING",
      "PAYMENT_FAILED",
      "CONFIRMED",
      "CANCELLED",
      "SHIPPED",
      "DELIVERED",
      "RETURN_REQUESTED",
      "RETURN_APPROVED",
      "RETURN_REJECTED",
      "REFUNDED",
    ],
    []
  );

  const shipmentStatusOptions = useMemo(
    () => ["PENDING", "CREATED", "IN_TRANSIT", "DELIVERED", "DELAYED", "RETURNED"],
    []
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: data.status,
          shipment: data.shipment,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Failed to save");
      toast.success("Order updated");
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
          <div className="sm:col-span-2">
            <dt className="text-meta-3">Email</dt>
            <dd className="mt-0.5 font-medium text-dark break-all">
              {data.customer?.email ?? "Guest"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-meta-3">Address</dt>
            <dd className="mt-0.5 font-medium text-dark">
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
          <div>
            <dt className="text-meta-3">Payment</dt>
            <dd className="mt-0.5 font-medium text-dark">
              {data.paymentMethod ?? "—"}
              {data.paymentStatus ? (
                <span className="block text-meta-3 font-normal">{data.paymentStatus}</span>
              ) : null}
            </dd>
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
            value={data.status ?? "PENDING"}
            onChange={(e) => setData((d: any) => ({ ...d, status: e.target.value }))}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Shipment</h2>
        <label className="block max-w-md">
          <span className="mb-1 block text-sm font-medium text-dark">Shipment status</span>
          <select
            value={data.shipment?.status ?? "PENDING"}
            onChange={(e) =>
              setData((d: any) => ({ ...d, shipment: { ...d.shipment, status: e.target.value } }))
            }
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          >
            {shipmentStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
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
          {data.items?.map((it: any) => (
            <li key={it.id} className="flex justify-between gap-4 border-b border-gray-3 pb-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{it.product_name}</div>
                <div className="text-xs text-meta-3 mt-0.5">
                  {formatPrice(Number(it.unit_price ?? 0))} × {it.quantity}
                </div>
              </div>
              <span className="shrink-0 font-medium">
                {formatPrice(Number(it.subtotal_amount ?? 0))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
