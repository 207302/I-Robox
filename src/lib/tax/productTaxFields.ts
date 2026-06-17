/** GST % on product list price (inclusive). Used for invoice split and ShipMozo — never shown on storefront. */

const ALLOWED_GST_PERCENTS = [0, 5, 12, 18, 28] as const;

export const GST_PERCENT_OPTIONS = ALLOWED_GST_PERCENTS;

const ALLOWED_GST_SET = new Set<number>(ALLOWED_GST_PERCENTS);

export function parseHsnCode(
  raw: unknown,
  options?: { required?: boolean }
): string | null | { error: string } | undefined {
  if (raw === undefined) {
    return options?.required ? { error: "HSN code is required" } : undefined;
  }
  if (raw === null || raw === "") {
    return options?.required ? { error: "HSN code is required" } : null;
  }
  if (typeof raw !== "string") return { error: "Invalid hsn_code" };
  const h = raw.replace(/\s/g, "").replace(/[^0-9,]/g, "").slice(0, 32);
  if (!h) return options?.required ? { error: "HSN code is required" } : null;
  return h;
}

export function parseGstPercent(
  raw: unknown,
  options?: { required?: boolean }
): number | null | { error: string } | undefined {
  if (raw === undefined) {
    return options?.required ? { error: "GST % is required" } : undefined;
  }
  if (raw === null || raw === "") {
    return options?.required ? { error: "GST % is required" } : null;
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || !ALLOWED_GST_SET.has(n)) {
    return { error: "GST % must be 0, 5, 12, 18, or 28" };
  }
  return n;
}

export function splitInclusiveGstAmount(
  inclusiveTotal: number,
  gstPercent: number
): { taxable: number; gst: number } {
  const total = Number.isFinite(inclusiveTotal) ? inclusiveTotal : 0;
  const rate = Number.isFinite(gstPercent) ? gstPercent : 0;
  if (total <= 0) return { taxable: 0, gst: 0 };
  if (rate <= 0) return { taxable: Number(total.toFixed(2)), gst: 0 };
  const taxable = total / (1 + rate / 100);
  const gst = total - taxable;
  return { taxable: Number(taxable.toFixed(2)), gst: Number(gst.toFixed(2)) };
}

export function taxableUnitPrice(inclusiveUnit: number, gstPercent: number): number {
  return splitInclusiveGstAmount(inclusiveUnit, gstPercent).taxable;
}

export function productTaxFieldsToForm(row: { hsn_code?: string | null; gst_percent?: number | null }) {
  return {
    hsn_code: row.hsn_code?.trim() ?? "",
    gst_percent: row.gst_percent == null ? "" : String(row.gst_percent),
  };
}
