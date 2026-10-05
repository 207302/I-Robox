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

/** Client-side cap so a stock request that never responds cannot leave checkout spinning. */
export const STOCK_CHECK_TIMEOUT_MS = 10_000;

export const STOCK_CHECK_TIMEOUT_MESSAGE =
  "Stock check timed out. You can retry, or continue — stock is confirmed again when the order is placed.";

export class StockCheckError extends Error {
  readonly timedOut: boolean;

  constructor(message: string, timedOut = false) {
    super(message);
    this.name = "StockCheckError";
    this.timedOut = timedOut;
  }
}

export async function fetchProductStockCheck(
  lines: StockCheckLine[],
  options?: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  }
): Promise<ProductStockCheckMap> {
  const normalized = lines
    .map((line) => ({
      productId: String(line.productId ?? "").trim(),
      productVariantId: line.productVariantId?.trim() || null,
    }))
    .filter((line) => line.productId);

  if (normalized.length === 0) return {};

  const timeoutMs = options?.timeoutMs ?? STOCK_CHECK_TIMEOUT_MS;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const params = new URLSearchParams({ lines: JSON.stringify(normalized) });
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onExternalAbort);
  }

  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const res = await Promise.race([
      fetchImpl(`/api/products/stock-check?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new StockCheckError(STOCK_CHECK_TIMEOUT_MESSAGE, true));
        }, timeoutMs);
      }),
    ]);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof data?.error === "string" ? data.error : "Unable to verify stock availability";
      throw new StockCheckError(message);
    }
    if (!data?.products || typeof data.products !== "object") {
      throw new StockCheckError("Invalid stock check response");
    }
    return data.products as ProductStockCheckMap;
  } catch (error) {
    if (timedOut) {
      if (error instanceof StockCheckError && error.timedOut) throw error;
      throw new StockCheckError(STOCK_CHECK_TIMEOUT_MESSAGE, true);
    }
    if (options?.signal?.aborted) throw error;
    if (error instanceof StockCheckError) throw error;
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to verify stock availability";
    throw new StockCheckError(message);
  } finally {
    if (timer) clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
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
