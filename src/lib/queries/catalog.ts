import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { safeCategoriesFindMany } from "@/lib/db/safeReads";

export const getCategories = cache(async () => {
  try {
    return await safeCategoriesFindMany({
      orderBy: { updated_at: "desc" },
    });
  } catch {
    return [];
  }
});

export const getCategoriesForAdmin = cache(async () => {
  try {
    return await safeCategoriesFindMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
  } catch {
    return [];
  }
});

export const getCategoriesForHome = cache(async () => {
  try {
    return await safeCategoriesFindMany({
      orderBy: { name: "asc" },
      take: 8,
      select: { id: true, name: true, slug: true },
    });
  } catch {
    return [];
  }
});

export const getBrandsForAdmin = cache(async () => {
  try {
    return await prisma.brands.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
  } catch {
    return [];
  }
});

export const getAdminProductPickerList = cache(async () => {
  try {
    return await prisma.products.findMany({
      orderBy: { name: "asc" },
      take: 600,
      select: { id: true, name: true, slug: true, base_price: true, discounted_price: true },
    });
  } catch {
    return [];
  }
});
