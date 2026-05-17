import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withDb } from "@/lib/withDb";

const useProductionDbGuard = process.env.NODE_ENV === "production";

function guarded<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  if (!useProductionDbGuard) {
    return op();
  }
  return withDb(op, fallback);
}

/** Wrapped `site_marketing_settings.findUnique` — null fallback when DB is down (prod only). */
export function safeSiteMarketingSettingsFindUnique(
  args: Prisma.site_marketing_settingsFindUniqueArgs
) {
  return guarded(() => prisma.site_marketing_settings.findUnique(args), null);
}

/** Wrapped `categories.findMany` — empty array fallback when DB is down (prod only). */
export function safeCategoriesFindMany(args: Prisma.categoriesFindManyArgs) {
  return guarded(() => prisma.categories.findMany(args), []);
}
