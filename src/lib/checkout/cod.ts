import { cache } from "react";
import { prisma } from "@/lib/prisma";

type CodProductScope = {
  id: string;
  brand_id: string | null;
  category_id: string | null;
};

export const getCodAllowedBrandIds = cache(async function getCodAllowedBrandIds(): Promise<string[]> {
  try {
    const rows = await prisma.cod_allowed_brands.findMany({ select: { brand_id: true } });
    return rows.map((row) => row.brand_id);
  } catch {
    return [];
  }
});

export const getCodAllowedCategoryIds = cache(
  async function getCodAllowedCategoryIds(): Promise<string[]> {
    try {
      const rows = await prisma.cod_allowed_categories.findMany({ select: { category_id: true } });
      return rows.map((row) => row.category_id);
    } catch {
      return [];
    }
  }
);

export async function getCodEligibilityForProducts(products: CodProductScope[]): Promise<{
  available: boolean;
  reason: string | null;
  allowedBrandIds: string[];
  allowedCategoryIds: string[];
}> {
  const [allowedBrandIds, allowedCategoryIds] = await Promise.all([
    getCodAllowedBrandIds(),
    getCodAllowedCategoryIds(),
  ]);

  const brandSet = new Set(allowedBrandIds);
  const categorySet = new Set(allowedCategoryIds);
  const hasAnyAllowList = brandSet.size > 0 || categorySet.size > 0;

  if (!hasAnyAllowList) {
    return {
      available: false,
      reason: "Cash on Delivery is not enabled for any products right now.",
      allowedBrandIds,
      allowedCategoryIds,
    };
  }

  const allEligible = products.every((product) => {
    const brandOk = product.brand_id != null && brandSet.has(product.brand_id);
    const categoryOk = product.category_id != null && categorySet.has(product.category_id);
    return brandOk || categoryOk;
  });

  return {
    available: allEligible,
    reason: allEligible
      ? null
      : "Cash on Delivery is not available for one or more items in your cart.",
    allowedBrandIds,
    allowedCategoryIds,
  };
}
