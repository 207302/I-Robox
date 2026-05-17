import { prisma } from "@/lib/prisma";

export type ResolvedTaxonomy = {
  type_id: string | null;
  subtype_id: string | null;
  collection_id: string | null;
  category_id: string | null;
};

/**
 * Validates hierarchy (sub category ⊂ category) and normalizes ids.
 * Product type is no longer used; type_id is always cleared on save.
 */
export async function resolveProductTaxonomyForSave(input: {
  category_id: string | null;
  subtype_id: string | null;
  collection_id: string | null;
}): Promise<ResolvedTaxonomy | { error: string }> {
  let { category_id, subtype_id, collection_id } = input;

  if (collection_id) {
    const col = await prisma.product_collections.findUnique({ where: { id: collection_id } });
    if (!col) return { error: "Collection not found" };
  } else {
    collection_id = null;
  }

  if (subtype_id) {
    const st = await prisma.product_subtypes.findUnique({
      where: { id: subtype_id },
      select: { id: true, category_id: true },
    });
    if (!st) return { error: "Sub category not found" };
    if (category_id && st.category_id !== category_id) {
      return { error: "Sub category does not belong to the selected category" };
    }
    if (!category_id) {
      category_id = st.category_id;
    }
  }

  return {
    category_id,
    type_id: null,
    subtype_id,
    collection_id,
  };
}
