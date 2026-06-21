/** Column order must match POST /api/admin/csv/products import and the admin CSV page. Slug may be blank — derived from name like the admin new-product form. */
export const PRODUCTS_CSV_COLUMNS = [
  "name",
  "slug",
  "base_price",
  "discounted_price",
  "shipping_per_unit",
  "max_order_quantity",
  "sku",
  "hsn_code",
  "gst_percent",
  "weight_g",
  "diecast_scale",
  "image_urls",
  "is_active",
  "available_quantity",
  "low_stock_threshold",
] as const;

/** Column order must match POST /api/admin/csv/inventory import. */
export const INVENTORY_CSV_COLUMNS = [
  "product_slug",
  "available_quantity",
  "low_stock_threshold",
] as const;

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function productsCsvHeaderLine(): string {
  return PRODUCTS_CSV_COLUMNS.join(",");
}

/** Blank template: header + example row (empty slug — importer generates from name). */
export function productsCsvTemplate(): string {
  const example = [
    "Toy Car",
    "",
    "199",
    "149",
    "0",
    "99",
    "SKU-1",
    "95030010",
    "18",
    "350",
    "64",
    "https://example.com/toy-car.jpg",
    "true",
    "50",
    "5",
  ].map(escapeCsvField);
  return `${productsCsvHeaderLine()}\n${example.join(",")}\n`;
}

export function inventoryCsvHeaderLine(): string {
  return INVENTORY_CSV_COLUMNS.join(",");
}

export function inventoryCsvTemplate(): string {
  return `${inventoryCsvHeaderLine()}\ntoy-car,50,5\n`;
}
