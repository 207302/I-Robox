import {
  SHIPMOZO_TRACKING_STEPS,
  type ShipmozoTrackingStatus,
} from "@/lib/shipping/shipmozoTrackingConstants";
import { shipmozoPublicTrackUrl } from "@/lib/shipping/shipmozoPublicTrackUrl";

const BRAND_RED = "#E63946";
const GRAY_LINE = "#d1d5db";
const GRAY_DOT = "#9ca3af";

const STEP_LABELS: Record<ShipmozoTrackingStatus, string> = {
  ORDER_PLACED: "Order Placed",
  PICKUP_GENERATED: "Pickup Generated",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeStatus(raw: string | null | undefined): ShipmozoTrackingStatus {
  const key = (raw ?? "").trim().toUpperCase() as ShipmozoTrackingStatus;
  return SHIPMOZO_TRACKING_STEPS.includes(key) ? key : "ORDER_PLACED";
}

function stepCircleHtml(completed: boolean, current: boolean): string {
  if (completed) {
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;width:28px;height:28px;border-radius:50%;background:${BRAND_RED};">
        <tr><td align="center" valign="middle" style="color:#fff;font-size:14px;font-weight:700;line-height:28px;width:28px;height:28px;">&#10003;</td></tr>
      </table>`;
  }
  if (current) {
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;width:28px;height:28px;border-radius:50%;border:2px solid ${BRAND_RED};background:#ffffff;">
        <tr><td align="center" valign="middle" style="width:28px;height:28px;line-height:28px;font-size:18px;color:${BRAND_RED};">&#9679;</td></tr>
      </table>`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;width:28px;height:28px;border-radius:50%;border:2px solid ${GRAY_LINE};background:#ffffff;">
      <tr><td align="center" valign="middle" style="width:28px;height:28px;line-height:28px;font-size:14px;color:${GRAY_DOT};">&#9675;</td></tr>
    </table>`;
}

function connectorCellHtml(active: boolean): string {
  const color = active ? BRAND_RED : GRAY_LINE;
  return `<td valign="middle" height="3" bgcolor="${color}" style="padding:0;height:3px;line-height:3px;font-size:3px;background-color:${color};">
    <span style="display:block;height:3px;line-height:3px;font-size:3px;max-height:3px;overflow:hidden;background-color:${color};">&#8203;</span>
  </td>`;
}

function progressIconsRowHtml(currentIndex: number): string {
  const cells: string[] = [];
  SHIPMOZO_TRACKING_STEPS.forEach((step, index) => {
    const completed = index < currentIndex;
    const current = index === currentIndex;
    cells.push(
      `<td align="center" valign="middle" width="28" style="width:28px;padding:0;vertical-align:middle;">${stepCircleHtml(completed, current)}</td>`
    );
    if (index < SHIPMOZO_TRACKING_STEPS.length - 1) {
      cells.push(connectorCellHtml(index < currentIndex));
    }
  });
  return `<tr>${cells.join("")}</tr>`;
}

function progressLabelsRowHtml(currentIndex: number): string {
  const cells = SHIPMOZO_TRACKING_STEPS.map((step, index) => {
    const current = index === currentIndex;
    return `<td width="20%" align="center" valign="top" style="padding:10px 1px 0;font-size:9px;line-height:1.35;color:${current ? "#111111" : "#6b7280"};font-weight:${current ? "700" : "400"};">
      ${escapeHtml(STEP_LABELS[step])}
    </td>`;
  }).join("");
  return `<tr>${cells}</tr>`;
}

/** Table-based 5-step progress bar for HTML email clients. */
export function shipmozoTrackingBarEmailHtml(input: {
  status: string | ShipmozoTrackingStatus;
  carrier?: string | null;
  awbNumber?: string | null;
  /** When false, only the step bar is shown (no carrier/AWB lines). Default true. */
  includeDetails?: boolean;
}): string {
  const status = normalizeStatus(input.status);
  const currentIndex = Math.max(0, SHIPMOZO_TRACKING_STEPS.indexOf(status));
  const carrier = input.carrier?.trim() ?? "";
  const awb = input.awbNumber?.trim() ?? "";
  const includeDetails = input.includeDetails !== false;

  const iconsRow = progressIconsRowHtml(currentIndex);
  const labelsRow = progressLabelsRowHtml(currentIndex);

  const metaLines: string[] = [];
  if (includeDetails) {
    if (carrier || awb) {
      const parts: string[] = [];
      if (carrier) parts.push(`Carrier: <strong>${escapeHtml(carrier)}</strong>`);
      if (awb) parts.push(`AWB: <strong>${escapeHtml(awb)}</strong>`);
      metaLines.push(`<p style="margin:12px 0 0;font-size:13px;color:#555;">${parts.join(" &nbsp;|&nbsp; ")}</p>`);
    }
    if (awb) {
      metaLines.push(
        `<p style="margin:8px 0 0;"><a href="${shipmozoPublicTrackUrl(awb)}" target="_blank" rel="noopener noreferrer" style="color:${BRAND_RED};font-size:13px;font-weight:600;text-decoration:none;">Track on ShipMozo &rarr;</a></p>`
      );
    }
  }

  return `
    <div style="margin:16px 0;padding:16px;background:#f8f8f8;border:1px solid #e5e5e5;border-radius:12px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#111;">Shipment progress</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;table-layout:fixed;">
        ${iconsRow}
        ${labelsRow}
      </table>
      ${metaLines.join("\n")}
    </div>`;
}

export function shipmozoTrackingBarEmailText(status: string | ShipmozoTrackingStatus): string {
  const normalized = normalizeStatus(status);
  const currentIndex = Math.max(0, SHIPMOZO_TRACKING_STEPS.indexOf(normalized));
  return SHIPMOZO_TRACKING_STEPS.map((step, index) => {
    const marker = index < currentIndex ? "[done]" : index === currentIndex ? "[now]" : "[ ]";
    return `${marker} ${STEP_LABELS[step]}`;
  }).join(" → ");
}
