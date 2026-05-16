import { prisma } from "@/lib/prisma";

export type ResolvedTaxonomy = {
  type_id: string | null;
  subtype_id: string | null;
  collection_id: string | null;
  /** When category was empty, may be set from the selected type. */
  category_id: string | null;
};

/**
 * Validates hierarchy (type ⊂ category, subtype ⊂ type) and normalizes ids.
 * Clears subtype when type is cleared. Optionally aligns category with the type.
 */
export async function resolveProductTaxonomyForSave(input: {
  category_id: string | null;
  type_id: string | null;
  subtype_id: string | null;
  collection_id: string | null;
}): Promise<ResolvedTaxonomy | { error: string }> {
  let { category_id, type_id, subtype_id, collection_id } = input;

  if (collection_id) {
    const col = await prisma.product_collections.findUnique({ where: { id: collection_id } });
    if (!col) return { error: "Collection not found" };
  } else {
    collection_id = null;
  }

  if (!type_id) {
    subtype_id = null;
  }

  if (subtype_id) {
    const st = await prisma.product_subtypes.findUnique({
      where: { id: subtype_id },
      include: { product_types: { select: { id: true, category_id: true } } },
    });
    if (!st) return { error: "Subtype not found" };
    if (type_id && st.product_type_id !== type_id) {
      return { error: "Subtype does not belong to the selected type" };
    }
    if (!type_id) {
      type_id = st.product_type_id;
    }
  }

  if (type_id) {
    const t = await prisma.product_types.findUnique({ where: { id: type_id } });
    if (!t) return { error: "Product type not found" };
    if (category_id && t.category_id !== category_id) {
      return { error: "Type does not belong to the selected category" };
    }
    if (!category_id) {
      category_id = t.category_id;
    }
  } else {
    type_id = null;
    subtype_id = null;
  }

  if (subtype_id && type_id) {
    const st = await prisma.product_subtypes.findUnique({ where: { id: subtype_id } });
    if (st && st.product_type_id !== type_id) {
      return { error: "Subtype does not belong to the selected type" };
    }
  }

  return {
    category_id,
    type_id,
    subtype_id,
    collection_id,
  };
}
