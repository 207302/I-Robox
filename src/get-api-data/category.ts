import { prisma } from "@/lib/prisma";

// get all categories
// Keep this uncached so storefront category links always use latest slug/name.
export async function getCategories() {
  try {
    return await prisma.categories.findMany({
      orderBy: { updated_at: "desc" },
    });
  } catch {
    return [];
  }
}