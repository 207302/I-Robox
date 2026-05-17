import { prisma } from "@/lib/prisma";

/** Max PDP paths pre-rendered at build (remainder served on first request). */
export const STATIC_PDP_BUILD_LIMIT = 200;

export async function getProductSlugsForStaticGeneration(
  limit = STATIC_PDP_BUILD_LIMIT
): Promise<{ slug: string }[]> {
  try {
    const rows = await prisma.products.findMany({
      where: { is_active: true },
      select: { slug: true },
      orderBy: { updated_at: "desc" },
      take: limit,
    });
    return rows.map((row) => ({ slug: row.slug }));
  } catch (err) {
    console.error("[productStaticParams] build slug list failed:", err);
    return [];
  }
}
