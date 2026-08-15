/** Human-readable ShipMozo failure for the admin orders list. */
export function shipmozoFailureSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const shipmozo = (metadata as Record<string, unknown>).shipmozo;
  if (!shipmozo || typeof shipmozo !== "object" || Array.isArray(shipmozo)) return null;
  const d = shipmozo as Record<string, unknown>;
  const status = String(d.status ?? "").trim().toLowerCase();
  if (status === "booked") return null;

  const push = d.pushOrder && typeof d.pushOrder === "object" ? (d.pushOrder as Record<string, unknown>) : null;
  if (push && push.ok === false) {
    const msg = String(push.message || push.error || d.error || "ShipMozo push failed").trim();
    return msg.slice(0, 180) || "ShipMozo push failed";
  }

  if (status === "skipped" || status === "error" || status === "failed") {
    const msg = String(d.error || d.message || d.reason || "ShipMozo issue").trim();
    return msg.slice(0, 180) || "ShipMozo issue";
  }

  if (d.reason === "invalid_contact_or_pin" || d.reason === "missing_shipping_address") {
    return String(d.error || d.reason).slice(0, 180);
  }

  return null;
}
