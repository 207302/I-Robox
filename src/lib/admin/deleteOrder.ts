import { prisma } from "@/lib/prisma";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";

export type DeleteOrderResult =
  | { ok: true; productIds: string[] }
  | { ok: false; status: 404 | 409; error: string };

export async function deleteOrderById(id: string): Promise<DeleteOrderResult> {
  const order = await prisma.orders.findUnique({
    where: { id },
    select: { id: true, payment_status: true },
  });
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const productIds: string[] = [];
  const paymentSucceeded = String(order.payment_status) === "SUCCEEDED";

  try {
    await prisma.$transaction(async (tx) => {
      const reservations = await tx.inventory_reservations.findMany({
        where: { order_id: id },
        select: {
          product_id: true,
          product_variant_id: true,
          quantity: true,
          released_at: true,
        },
      });

      for (const r of reservations) {
        productIds.push(r.product_id);

        if (r.released_at === null) {
          const updated = await tx.inventory.updateMany({
            where: {
              product_id: r.product_id,
              product_variant_id: r.product_variant_id,
              reserved_quantity: { gte: r.quantity },
            },
            data: {
              reserved_quantity: { decrement: r.quantity },
              available_quantity: { increment: r.quantity },
            },
          });
          if (updated.count !== 1) {
            throw new Error("INVENTORY_RESTORE_FAILED");
          }
          continue;
        }

        if (paymentSucceeded) {
          const updated = await tx.inventory.updateMany({
            where: {
              product_id: r.product_id,
              product_variant_id: r.product_variant_id,
              sold_quantity: { gte: r.quantity },
            },
            data: {
              sold_quantity: { decrement: r.quantity },
              available_quantity: { increment: r.quantity },
            },
          });
          if (updated.count !== 1) {
            throw new Error("INVENTORY_RESTORE_FAILED");
          }
        }
      }

      await tx.coupon_usages.deleteMany({ where: { order_id: id } });
      await tx.orders.delete({ where: { id } });
    }, PRISMA_TRANSACTION_OPTIONS);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "INVENTORY_RESTORE_FAILED") {
      return {
        ok: false,
        status: 409,
        error:
          "Could not restore stock for this order. Fix inventory manually or cancel the order first.",
      };
    }
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2003") {
      return {
        ok: false,
        status: 409,
        error: "Order has linked records that block deletion.",
      };
    }
    throw e;
  }

  return { ok: true, productIds: [...new Set(productIds)] };
}
