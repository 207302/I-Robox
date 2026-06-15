import { prisma } from "@/lib/prisma";

/** Product IDs the customer bought (paid) after the cart was last updated. */
export async function purchasedProductIdsAfterCartUpdate(input: {
  customerId: string;
  cartUpdatedAt: Date;
  productIds: string[];
}): Promise<Set<string>> {
  const { customerId, cartUpdatedAt, productIds } = input;
  if (!customerId || productIds.length === 0) return new Set();

  const rows = await prisma.order_items.findMany({
    where: {
      product_id: { in: productIds },
      orders: {
        customer_id: customerId,
        payment_status: "SUCCEEDED",
        created_at: { gt: cartUpdatedAt },
      },
    },
    select: { product_id: true },
    distinct: ["product_id"],
  });

  return new Set(rows.map((r) => r.product_id));
}
