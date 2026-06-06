import type { Prisma } from "@prisma/client";

export const ORDER_NUMBER_PREFIX = "IRx";
/** First customer-facing order number (IRx10001). */
export const ORDER_NUMBER_START = 10001;

function parseOrderSequence(orderNumber: string): number | null {
  const numeric = orderNumber.trim().replace(/^IR[xX]-?/i, "").replace(/\D/g, "");
  if (!numeric) return null;
  const n = Number.parseInt(numeric, 10);
  return Number.isFinite(n) ? n : null;
}

function formatOrderIdFromSequence(sequenceValue: number): string {
  return `${ORDER_NUMBER_PREFIX}${String(Math.trunc(sequenceValue)).padStart(5, "0")}`;
}

export function formatSequentialOrderNumber(sequenceValue: number): string {
  if (!Number.isFinite(sequenceValue) || sequenceValue < ORDER_NUMBER_START) {
    throw new Error("INVALID_ORDER_SEQUENCE");
  }
  return formatOrderIdFromSequence(sequenceValue);
}

export type OrderReferenceSource = {
  id: string;
  order_number?: string | null;
};

/** Customer-facing order reference (never the raw UUID). */
export function formatOrderReference(order: OrderReferenceSource): string {
  const stored = order.order_number?.trim();
  if (stored) {
    const n = parseOrderSequence(stored);
    if (n !== null) return formatOrderIdFromSequence(n);
    return stored;
  }
  return `${ORDER_NUMBER_PREFIX}?????`;
}

/** Admin display: IRx + 5-digit id (e.g. IRX-10046 → IRx10046). */
export function compactOrderId(orderNumber: string | null | undefined): string {
  const stored = orderNumber?.trim();
  if (!stored) return `${ORDER_NUMBER_PREFIX}00000`;
  const n = parseOrderSequence(stored);
  if (n !== null) return formatOrderIdFromSequence(n);
  return stored;
}

export function shipmozoOrderRef(order: OrderReferenceSource): string {
  return formatOrderReference(order).replace(/-/g, "").slice(0, 30);
}

/** Atomically allocate the next sequential order number (IRx10001, IRx10002, …). */
export async function allocateNextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('orders_order_number_seq') AS nextval
  `;
  const raw = rows[0]?.nextval;
  const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
  return formatSequentialOrderNumber(n);
}
