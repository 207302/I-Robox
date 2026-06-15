export type ProductPackageFields = {
  weight_g?: number | null;
};

function parsePositiveInt(
  raw: unknown,
  max: number
): number | null | { error: string } | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > max) {
    return { error: "Invalid weight_g" };
  }
  return n;
}

export function parseProductPackageFieldsIn(
  body: Record<string, unknown>
): ProductPackageFields | { error: string } | undefined {
  const weight_g = parsePositiveInt(body.weight_g, 30_000);
  if (typeof weight_g === "object" && weight_g && "error" in weight_g) return weight_g;
  if (weight_g === undefined) return undefined;
  return { weight_g };
}

export function productPackageFieldsToForm(row: { weight_g?: number | null }) {
  const num = (v: unknown) => (v == null || v === "" ? "" : String(Number(v)));
  return { weight_g: num(row.weight_g) };
}
