import { truncateMetaDescription } from "@/lib/seo/metadata";

type CategorySeoSource = {
  name: string;
  slug?: string;
  description?: string | null;
};

export function categoryListingMetaDescription(category: CategorySeoSource): string {
  const fromDb = category.description?.replace(/\s+/g, " ").trim();
  if (fromDb) return truncateMetaDescription(fromDb, 155);
  return truncateMetaDescription(
    `Explore ${category.name} — RC toys, diecast models, and collectibles at i-robox with fast delivery across India.`,
    155
  );
}

export function shopPageHeading(
  categorySlugs: string[],
  categories: CategorySeoSource[]
): string {
  if (categorySlugs.length === 1) {
    const match = categories.find((c) => c.slug === categorySlugs[0]);
    if (match?.name) return `Shop ${match.name}`;
  }
  return "Shop";
}
