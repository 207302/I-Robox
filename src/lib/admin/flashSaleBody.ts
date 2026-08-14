import { isUuid } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  flashSaleHasScope,
  isFlashDiscountType,
  type FlashDiscountType,
} from "@/lib/pricing/flashSaleTypes";

export const FLASH_SALE_MAX_PURCHASE_LIMIT = 99;

export type ParsedFlashSaleBody = {
  name: string | null;
  purchase_limit: number;
  discount_type: FlashDiscountType;
  discount_value: number;
  is_active: boolean;
  active_from: Date | null;
  active_until: Date | null;
  product_ids: string[];
  category_ids: string[];
  brand_ids: string[];
};

function parsePurchaseLimit(body: Record<string, unknown>): number | { error: string } {
  if (body.purchase_limit !== undefined && body.purchase_limit !== null && body.purchase_limit !== "") {
    const n = Number(body.purchase_limit);
    if (!Number.isFinite(n) || n < 0 || n > FLASH_SALE_MAX_PURCHASE_LIMIT) {
      return { error: `purchase_limit must be between 0 and ${FLASH_SALE_MAX_PURCHASE_LIMIT}` };
    }
    return Math.trunc(n);
  }
  if (typeof body.limit_one_per_customer === "boolean") {
    return body.limit_one_per_customer ? 1 : 0;
  }
  return 0;
}

function parseUuidList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  if (ids.some((id) => !isUuid(id))) return null;
  return ids;
}

export function parseFlashSaleBody(
  body: Record<string, unknown>
): { ok: true; data: ParsedFlashSaleBody } | { ok: false; error: string } {
  const discount_type = String(body.discount_type ?? "FIXED").toUpperCase();
  if (!isFlashDiscountType(discount_type)) {
    return { ok: false, error: "discount_type must be FIXED or PERCENTAGE" };
  }

  const discount_value = Number(body.discount_value);
  if (!Number.isFinite(discount_value) || discount_value <= 0) {
    return { ok: false, error: "Invalid discount_value" };
  }
  if (discount_type === "PERCENTAGE" && discount_value > 100) {
    return { ok: false, error: "Percentage must be between 0 and 100" };
  }

  const product_ids = parseUuidList(body.product_ids);
  const category_ids = parseUuidList(body.category_ids);
  const brand_ids = parseUuidList(body.brand_ids);
  if (product_ids === null || category_ids === null || brand_ids === null) {
    return { ok: false, error: "Invalid scope ids" };
  }

  const scope = { product_ids, category_ids, brand_ids };
  if (!flashSaleHasScope(scope)) {
    return { ok: false, error: "Select at least one product, category, or brand" };
  }

  const nameRaw = body.name == null ? null : String(body.name).trim();
  const name = nameRaw ? nameRaw.slice(0, 120) : null;
  const is_active = body.is_active === undefined ? true : Boolean(body.is_active);
  const purchaseLimitParsed = parsePurchaseLimit(body);
  if (typeof purchaseLimitParsed === "object") {
    return { ok: false, error: purchaseLimitParsed.error };
  }
  const purchase_limit = purchaseLimitParsed;

  const active_from =
    body.active_from === undefined ? null : parseOptionalDate(body.active_from) ?? null;
  if (
    body.active_from !== undefined &&
    body.active_from !== null &&
    body.active_from !== "" &&
    active_from === undefined
  ) {
    return { ok: false, error: "Invalid active_from" };
  }

  const active_until =
    body.active_until === undefined ? null : parseOptionalDate(body.active_until) ?? null;
  if (
    body.active_until !== undefined &&
    body.active_until !== null &&
    body.active_until !== "" &&
    active_until === undefined
  ) {
    return { ok: false, error: "Invalid active_until" };
  }

  return {
    ok: true,
    data: {
      name,
      purchase_limit,
      discount_type,
      discount_value,
      is_active,
      active_from: active_from ?? null,
      active_until: active_until ?? null,
      product_ids,
      category_ids,
      brand_ids,
    },
  };
}

export const flashSaleAdminInclude = {
  products: { include: { products: { select: { id: true, name: true, slug: true } } } },
  categories: { include: { categories: { select: { id: true, name: true, slug: true } } } },
  brands: { include: { brands: { select: { id: true, name: true, slug: true } } } },
} as const;

export async function replaceFlashSaleScope(
  flashSaleId: string,
  data: {
    product_ids: string[];
    category_ids: string[];
    brand_ids: string[];
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  await db.flash_sale_products.deleteMany({ where: { flash_sale_id: flashSaleId } });
  await db.flash_sale_categories.deleteMany({ where: { flash_sale_id: flashSaleId } });
  await db.flash_sale_brands.deleteMany({ where: { flash_sale_id: flashSaleId } });

  if (data.product_ids.length) {
    await db.flash_sale_products.createMany({
      data: data.product_ids.map((product_id) => ({ flash_sale_id: flashSaleId, product_id })),
    });
  }
  if (data.category_ids.length) {
    await db.flash_sale_categories.createMany({
      data: data.category_ids.map((category_id) => ({ flash_sale_id: flashSaleId, category_id })),
    });
  }
  if (data.brand_ids.length) {
    await db.flash_sale_brands.createMany({
      data: data.brand_ids.map((brand_id) => ({ flash_sale_id: flashSaleId, brand_id })),
    });
  }
}

export function serializeFlashSaleRow(row: {
  id: string;
  name: string | null;
  purchase_limit?: number;
  discount_type: string;
  discount_value: { toString(): string } | number;
  is_active: boolean;
  active_from: Date | null;
  active_until: Date | null;
  created_at: Date;
  updated_at: Date;
  products: { products: { id: string; name: string; slug: string } }[];
  categories: { categories: { id: string; name: string; slug: string } }[];
  brands: { brands: { id: string; name: string; slug: string } }[];
}) {
  return {
    id: row.id,
    name: row.name,
    purchase_limit: Math.max(0, Math.trunc(row.purchase_limit ?? 0)),
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    is_active: row.is_active,
    active_from: row.active_from,
    active_until: row.active_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product_ids: row.products.map((p) => p.products.id),
    category_ids: row.categories.map((c) => c.categories.id),
    brand_ids: row.brands.map((b) => b.brands.id),
    products: row.products.map((p) => p.products),
    categories: row.categories.map((c) => c.categories),
    brands: row.brands.map((b) => b.brands),
  };
}
