import { NextRequest } from "next/server";
import { sanitizeQuickLinkHtml } from "@/lib/sanitizeQuickLinkHtml";

export type FieldErrors = Record<string, string>;

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

/**
 * For CSV / multiline admin payloads: strips NUL/DEL and BOM only.
 * {@link cleanText} removes all control chars including newlines and would flatten CSV to one line.
 */
export function sanitizeCsvPayload(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  let s = value.replace(/\u0000/g, "").replace(/\u007F/g, "");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.trim().slice(0, maxLength);
}

export function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = cleanText(value, maxLength);
  return cleaned.length ? cleaned : null;
}

/** Rich-text fields (TinyMCE): sanitize HTML, preserve markup, strip dangerous content. */
export function cleanOptionalHtml(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  let s = value.replace(/\u0000/g, "").replace(/\u007F/g, "");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = sanitizeQuickLinkHtml(s.trim()).slice(0, maxLength);
  return s.length ? s : null;
}

/** Optional `#rgb` or `#rrggbb` for CMS color fields; empty/null clears the override. */
export function cleanOptionalHexColor(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  const normalized =
    t.startsWith("#") ? t : `#${t}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(normalized)) {
    const r = normalized[1];
    const g = normalized[2];
    const b = normalized[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  return null;
}

export function normalizeEmail(value: unknown) {
  return cleanText(value, 320).toLowerCase();
}

export function normalizePhone(value: unknown) {
  const raw = cleanText(value, 30);
  return raw.replace(/\s+/g, "");
}

export function normalizeCode(value: unknown, maxLength = 80) {
  return cleanText(value, maxLength).toUpperCase();
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Heuristic filter for obvious SQL / script-injection probes.
 * Prisma still parameterizes all queries — this is defense in depth.
 * Do not use on password fields (users may legitimately use characters that look like SQL).
 */
export function hasSuspiciousInput(value: string) {
  if (!value) return false;
  const v = value.toLowerCase();
  // Intentionally omit bare `--` — it false-positives on ranges/SKUs (e.g. "1--10").
  const patterns: RegExp[] = [
    /;\s*(select|insert|update|delete|drop|alter|create|truncate|merge|exec|execute|grant|revoke)\b/,
    /\bunion\s+all\s+select\b|\bunion\s+select\b/,
    /\bor\s+1\s*=\s*1\b|\bor\s+'1'\s*=\s*'1'/,
    /;\s*drop\s+table\b/,
    /\/\*/, // block comment start
    /@@\w+/, // e.g. @@version
    /\binto\s+outfile\b|\bload_file\s*\(/,
    /\bpg_sleep\s*\(|\bsleep\s*\(|\bbenchmark\s*\(/,
    /\bwaitfor\s+delay\b/,
    /\bxp_\w+/, // extended procs (SQL Server style)
    /\bchar\s*\(\s*\d+/, // CHAR(…) concat chains
    /\binformation_schema\b/,
  ];
  return patterns.some((re) => re.test(v));
}

/** URL slug param: letters, digits, hyphens, underscores (category / brand filters). */
export function isUrlSlug(value: string) {
  if (value.length > 160) return false;
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value);
}

const ORDER_STATUS_WHITELIST = new Set([
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
]);

/** Manual admin payment-status marks surfaced in the order status dropdown. */
const ADMIN_PAYMENT_STATUS_MARK_WHITELIST = new Set(["PARTIALLY_REFUNDED"]);

export function isAllowedOrderStatus(value: string) {
  return ORDER_STATUS_WHITELIST.has(value) || ADMIN_PAYMENT_STATUS_MARK_WHITELIST.has(value);
}

const SHIPMENT_STATUS_WHITELIST = new Set([
  "PENDING",
  "CREATED",
  "IN_TRANSIT",
  "DELIVERED",
  "DELAYED",
  "RETURNED",
]);

export function isAllowedShipmentStatus(value: string) {
  return SHIPMENT_STATUS_WHITELIST.has(value);
}

const COUPON_DISCOUNT_WHITELIST = new Set(["PERCENTAGE", "FIXED"]);

export function isAllowedCouponDiscountType(value: string) {
  return COUPON_DISCOUNT_WHITELIST.has(value);
}

export async function readJsonBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false as const, body: null };
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const, body: null };
  }
  return { ok: true as const, body: body as Record<string, unknown> };
}
