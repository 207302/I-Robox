import { prisma } from "@/lib/prisma";

export type CategoryPagePayload = {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
  };
  heroImage: string | null;
  stats: {
    productCount: number;
  };
  subcategories: { id: string; name: string; slug: string }[];
};

export async function getCategoryPagePayload(slug: string): Promise<CategoryPagePayload | null> {
  const category = await prisma.categories.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parent_id: true,
      category_pages: { select: { hero_image: true } },
    },
  });
  if (!category) return null;

  const [productCount, subcategories] = await Promise.all([
    prisma.products.count({
      where: { category_id: category.id, is_active: true },
    }),
    prisma.categories.findMany({
      where: { parent_id: category.id },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parent_id,
    },
    heroImage: category.category_pages?.hero_image ?? null,
    stats: { productCount },
    subcategories,
  };
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const rows = await prisma.categories.findMany({
    select: { slug: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.slug);
}
