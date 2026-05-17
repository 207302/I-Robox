import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/validation/input";

export const subcategoryListSelect = {
  id: true,
  category_id: true,
  product_type_id: true,
  name: true,
  slug: true,
  is_active: true,
  sort_order: true,
} as const;

/** Resolve category for subcategory listing (category_id or legacy type_id). */
export async function resolveSubcategoryCategoryId(
  categoryId: string | null | undefined,
  typeId: string | null | undefined
): Promise<string | null> {
  if (categoryId && isUuid(categoryId)) return categoryId;
  if (!typeId || !isUuid(typeId)) return null;

  const productType = await prisma.product_types.findUnique({
    where: { id: typeId },
    select: { category_id: true },
  });
  if (productType?.category_id) return productType.category_id;

  const subtype = await prisma.product_subtypes.findUnique({
    where: { id: typeId },
    select: { category_id: true },
  });
  return subtype?.category_id ?? null;
}

export async function listProductSubcategoriesByCategory(categoryId: string) {
  return prisma.product_subtypes.findMany({
    where: { category_id: categoryId },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: subcategoryListSelect,
  });
}

/** Legacy POST bodies may send product_type_id instead of category_id. */
export async function resolveSubcategoryCategoryIdFromBody(body: Record<string, unknown>): Promise<string | null> {
  const direct =
    typeof body.category_id === "string"
      ? body.category_id
      : typeof body.categoryId === "string"
        ? body.categoryId
        : "";
  if (isUuid(direct)) return direct;

  const typeRef =
    typeof body.product_type_id === "string"
      ? body.product_type_id
      : typeof body.productTypeId === "string"
        ? body.productTypeId
        : typeof body.type_id === "string"
          ? body.type_id
          : typeof body.typeId === "string"
            ? body.typeId
            : "";

  return resolveSubcategoryCategoryId(null, typeRef || null);
}
