import { stockLookupKey } from "@/lib/inventory/cartStockShared";

export type ProductStockCheck = {
  availableQuantity: number;
  inStock: boolean;
};

export type ProductStockCheckMap = Record<string, ProductStockCheck>;

export type StockCheckLine = {
  productId: string;
  productVariantId?: string | null;
};

export async function fetchProductStockCheck(
  lines: StockCheckLine[]
): Promise<ProductStockCheckMap> {
  const normalized = lines
    .map((line) => ({
      productId: String(line.productId ?? "").trim(),
      productVariantId: line.productVariantId?.trim() || null,
    }))
    .filter((line) => line.productId);

  if (normalized.length === 0) return {};

  const params = new URLSearchParams({ lines: JSON.stringify(normalized) });
  const res = await fetch(`/api/products/stock-check?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === "string" ? data.error : "Unable to verify stock availability";
    throw new Error(message);
  }
  if (!data?.products || typeof data.products !== "object") {
    throw new Error("Invalid stock check response");
  }
  return data.products as ProductStockCheckMap;
}

export function lineItemStockError(input: {
  name: string;
  quantity: number;
  stock?: ProductStockCheck;
}): string | null {
  const stock = input.stock;
  if (!stock) return null;
  if (stock.availableQuantity >= input.quantity) return null;
  if (stock.availableQuantity <= 0) {
    return `${input.name} is out of stock`;
  }
  return `${input.name} only has ${stock.availableQuantity} available`;
}

export { stockLookupKey };
