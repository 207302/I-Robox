import { prisma } from "@/lib/prisma";

/** Stock row for the product itself (no variant). Prisma upsert cannot use null in compound unique where. */
export async function upsertProductLevelInventory(
  productId: string,
  data: { available_quantity: number; low_stock_threshold: number }
) {
  const existing = await prisma.inventory.findFirst({
    where: { product_id: productId, product_variant_id: null },
    select: { id: true },
  });
  if (existing) {
    return prisma.inventory.update({
      where: { id: existing.id },
      data: {
        available_quantity: data.available_quantity,
        low_stock_threshold: data.low_stock_threshold,
      },
    });
  }
  return prisma.inventory.create({
    data: {
      product_id: productId,
      product_variant_id: null,
      available_quantity: data.available_quantity,
      reserved_quantity: 0,
      sold_quantity: 0,
      low_stock_threshold: data.low_stock_threshold,
    },
  });
}
