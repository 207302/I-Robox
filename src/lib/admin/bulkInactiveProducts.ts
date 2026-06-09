import { prisma } from "@/lib/prisma";

export async function bulkInactiveProductsByIds(ids: string[]): Promise<{
  inactivated: { id: string; slug: string }[];
  failed: { id: string; name: string | null; error: string }[];
}> {
  const uniqueIds = [...new Set(ids)];
  const inactivated: { id: string; slug: string }[] = [];
  const failed: { id: string; name: string | null; error: string }[] = [];

  if (uniqueIds.length === 0) return { inactivated, failed };

  const products = await prisma.products.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, slug: true, name: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const foundIds: string[] = [];
  for (const id of uniqueIds) {
    const product = productById.get(id);
    if (!product) {
      failed.push({ id, name: null, error: "Product not found" });
      continue;
    }
    foundIds.push(id);
  }

  if (foundIds.length > 0) {
    await prisma.products.updateMany({
      where: { id: { in: foundIds } },
      data: { is_active: false },
    });
    for (const id of foundIds) {
      const product = productById.get(id)!;
      inactivated.push({ id, slug: product.slug });
    }
  }

  return { inactivated, failed };
}
