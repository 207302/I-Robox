import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withDb } from "@/lib/withDb";

/** Wrapped `site_marketing_settings.findUnique` — null fallback when DB is down. */
export function safeSiteMarketingSettingsFindUnique(
  args: Prisma.site_marketing_settingsFindUniqueArgs
) {
  return withDb(() => prisma.site_marketing_settings.findUnique(args), null);
}

/** Wrapped `categories.findMany` — empty array fallback when DB is down. */
export function safeCategoriesFindMany(args: Prisma.categoriesFindManyArgs) {
  return withDb(() => prisma.categories.findMany(args), []);
}
