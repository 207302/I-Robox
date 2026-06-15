import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

/** Remove all lines from the customer's active server cart (e.g. after checkout). */
export async function clearCustomerServerCart(
  customerId: string,
  db: Db = prisma
): Promise<void> {
  const id = customerId.trim();
  if (!id) return;

  const cart = await db.carts.findFirst({
    where: { customer_id: id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!cart) return;

  await db.cart_items.deleteMany({ where: { cart_id: cart.id } });
  await db.carts.update({
    where: { id: cart.id },
    data: { updated_at: new Date() },
  });
}
