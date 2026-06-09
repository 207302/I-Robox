import type { Prisma } from "@prisma/client";

/** Orders that no longer block product deletion. */
export const TERMINAL_ORDER_STATUSES = [
  "REFUNDED",
  "CANCELLED",
  "PAYMENT_FAILED",
] as const;

/** Orders that still block product deletion. */
export const ACTIVE_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "RETURN_REJECTED",
] as const;

export type OrderInventoryRestoreResult =
  | { ok: true; productIds: string[] }
  | { ok: false; error: string };

/** Put sold units back into available stock after a refund (paid orders only). */
export async function restoreSoldInventoryForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentSucceeded: boolean
): Promise<OrderInventoryRestoreResult> {
  if (!paymentSucceeded) {
    return { ok: true, productIds: [] };
  }

  const items = await tx.order_items.findMany({
    where: { order_id: orderId },
    select: { product_id: true, product_variant_id: true, quantity: true },
  });

  const productIds: string[] = [];
  for (const item of items) {
    const updated = await tx.inventory.updateMany({
      where: {
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        sold_quantity: { gte: item.quantity },
      },
      data: {
        sold_quantity: { decrement: item.quantity },
        available_quantity: { increment: item.quantity },
      },
    });
    if (updated.count === 1) {
      productIds.push(item.product_id);
    }
    // sold_quantity already reflects a prior restore (e.g. backfill) — skip, still allow refund.
  }

  return { ok: true, productIds: [...new Set(productIds)] };
}

export function orderPaymentCountedAsSold(paymentStatus: string): boolean {
  return paymentStatus === "SUCCEEDED" || paymentStatus === "REFUNDED";
}

export type BackfillInventoryLineResult = {
  productId: string;
  productVariantId: string | null;
  quantity: number;
  action: "restored" | "skipped";
  reason?: string;
  soldBefore?: number;
  availableBefore?: number;
};

export type BackfillInventoryOrderResult = {
  orderId: string;
  orderNumber: string;
  lines: BackfillInventoryLineResult[];
};

export type BackfillRefundedInventoryResult = {
  dryRun: boolean;
  orders: BackfillInventoryOrderResult[];
  restoredLines: number;
  skippedLines: number;
  productIds: string[];
};

/** Idempotent backfill for orders already marked REFUNDED before restore-on-refund existed. */
export async function backfillRestoreSoldInventoryForRefundedOrders(
  tx: Prisma.TransactionClient,
  options: { dryRun?: boolean; orderIds?: string[] } = {}
): Promise<BackfillRefundedInventoryResult> {
  const dryRun = options.dryRun ?? false;
  const orders = await tx.orders.findMany({
    where: {
      status: "REFUNDED",
      payment_status: { in: ["SUCCEEDED", "REFUNDED"] },
      ...(options.orderIds?.length ? { id: { in: options.orderIds } } : {}),
    },
    select: {
      id: true,
      order_number: true,
      order_items: {
        select: {
          product_id: true,
          product_variant_id: true,
          quantity: true,
        },
      },
    },
    orderBy: { created_at: "asc" },
  });

  const result: BackfillRefundedInventoryResult = {
    dryRun,
    orders: [],
    restoredLines: 0,
    skippedLines: 0,
    productIds: [],
  };

  for (const order of orders) {
    const orderResult: BackfillInventoryOrderResult = {
      orderId: order.id,
      orderNumber: order.order_number,
      lines: [],
    };

    for (const item of order.order_items) {
      const inventory = await tx.inventory.findFirst({
        where: {
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
        },
        select: {
          sold_quantity: true,
          available_quantity: true,
        },
      });

      if (!inventory) {
        orderResult.lines.push({
          productId: item.product_id,
          productVariantId: item.product_variant_id,
          quantity: item.quantity,
          action: "skipped",
          reason: "inventory row missing",
        });
        result.skippedLines += 1;
        continue;
      }

      if (inventory.sold_quantity < item.quantity) {
        orderResult.lines.push({
          productId: item.product_id,
          productVariantId: item.product_variant_id,
          quantity: item.quantity,
          action: "skipped",
          reason: "already restored or never sold",
          soldBefore: inventory.sold_quantity,
          availableBefore: inventory.available_quantity,
        });
        result.skippedLines += 1;
        continue;
      }

      if (!dryRun) {
        const updated = await tx.inventory.updateMany({
          where: {
            product_id: item.product_id,
            product_variant_id: item.product_variant_id,
            sold_quantity: { gte: item.quantity },
          },
          data: {
            sold_quantity: { decrement: item.quantity },
            available_quantity: { increment: item.quantity },
          },
        });
        if (updated.count !== 1) {
          orderResult.lines.push({
            productId: item.product_id,
            productVariantId: item.product_variant_id,
            quantity: item.quantity,
            action: "skipped",
            reason: "inventory changed during backfill",
            soldBefore: inventory.sold_quantity,
            availableBefore: inventory.available_quantity,
          });
          result.skippedLines += 1;
          continue;
        }
      }

      orderResult.lines.push({
        productId: item.product_id,
        productVariantId: item.product_variant_id,
        quantity: item.quantity,
        action: "restored",
        soldBefore: inventory.sold_quantity,
        availableBefore: inventory.available_quantity,
      });
      result.restoredLines += 1;
      result.productIds.push(item.product_id);
    }

    if (orderResult.lines.some((line) => line.action === "restored")) {
      result.orders.push(orderResult);
    }
  }

  result.productIds = [...new Set(result.productIds)];
  return result;
}
