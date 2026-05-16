import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";

/** Product id → flash sale unit price (when active). */
export async function flashSalePriceMap(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (productIds.length === 0) return map;
  const now = new Date();
  const rows = await prisma.flash_sale_products.findMany({
    where: { product_id: { in: productIds }, is_active: true },
    select: {
      product_id: true,
      sale_price: true,
      active_from: true,
      active_until: true,
      is_active: true,
    },
  });
  for (const r of rows) {
    if (isActiveInWindow(r.is_active, r.active_from, r.active_until, now)) {
      map.set(r.product_id, Number(r.sale_price));
    }
  }
  return map;
}

export function unitPriceWithFlashSale(
  catalogUnit: number,
  productId: string,
  flashMap: Map<string, number>
): number {
  const flash = flashMap.get(productId);
  return flash != null ? flash : catalogUnit;
}
