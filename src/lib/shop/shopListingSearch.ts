import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { profiledQuery, type ShopListingProfile } from "@/lib/shop/shopListingProfile";

function normalizeSearchTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function getSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const noSpaces = trimmed.replace(/\s+/g, "");
  const withSpaces = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");
  const spaced = noSpaces.replace(/([a-z]{2,})([a-z])/g, (_, a, b) => `${a} ${b}`);

  return [...new Set([trimmed, noSpaces, withSpaces, spaced])].filter(Boolean);
}

async function resolveNormalizedIlikeSearchIds(rawQ: string, profile: ShopListingProfile): Promise<string[]> {
  const compact = normalizeSearchTerm(rawQ);
  const spaced = rawQ.toLowerCase().trim();
  if (!compact && !spaced) return [];

  const compactPattern = `%${escapeIlikePattern(compact)}%`;
  const spacedPattern = `%${escapeIlikePattern(spaced)}%`;

  const extraSpacedPatterns = getSearchVariants(rawQ)
    .map((v) => v.toLowerCase().trim())
    .filter((v) => v.length > 0 && v !== spaced && v !== compact)
    .slice(0, 4)
    .map((v) => `%${escapeIlikePattern(v)}%`);

  const extraClauseParts = extraSpacedPatterns.flatMap((pattern) => [
    Prisma.sql`OR LOWER(p.name) ILIKE ${pattern}`,
    Prisma.sql`OR LOWER(COALESCE(b.name, '')) ILIKE ${pattern}`,
    Prisma.sql`OR LOWER(COALESCE(p.short_description, '')) ILIKE ${pattern}`,
    Prisma.sql`OR LOWER(COALESCE(st.name, '')) ILIKE ${pattern}`,
  ]);
  const extraClauses =
    extraClauseParts.length > 0 ? Prisma.join(extraClauseParts, " ") : Prisma.sql``;

  const rows = await profiledQuery(profile, "search.ilike", () =>
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT DISTINCT p.id
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_subtypes st ON p.subtype_id = st.id
      WHERE p.is_active = true
        AND (
          LOWER(REPLACE(p.name, ' ', '')) ILIKE ${compactPattern}
          OR LOWER(REPLACE(COALESCE(p.short_description, ''), ' ', '')) ILIKE ${compactPattern}
          OR LOWER(REPLACE(COALESCE(p.description, ''), ' ', '')) ILIKE ${compactPattern}
          OR LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')) ILIKE ${compactPattern}
          OR LOWER(REPLACE(COALESCE(c.name, ''), ' ', '')) ILIKE ${compactPattern}
          OR LOWER(REPLACE(COALESCE(st.name, ''), ' ', '')) ILIKE ${compactPattern}
          OR LOWER(p.name) ILIKE ${spacedPattern}
          OR LOWER(COALESCE(p.short_description, '')) ILIKE ${spacedPattern}
          OR LOWER(COALESCE(p.description, '')) ILIKE ${spacedPattern}
          OR LOWER(COALESCE(b.name, '')) ILIKE ${spacedPattern}
          OR LOWER(COALESCE(c.name, '')) ILIKE ${spacedPattern}
          OR LOWER(COALESCE(st.name, '')) ILIKE ${spacedPattern}
          ${extraClauses}
        )
      LIMIT 50
    `)
  );
  return rows.map((r) => r.id);
}

async function resolveFtsSearchIds(rawQ: string, profile: ShopListingProfile): Promise<string[]> {
  const variants = getSearchVariants(rawQ).filter((v) => /[a-z0-9]/i.test(v));
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const term of variants.slice(0, 5)) {
    try {
      const rows = await profiledQuery(profile, "search.fts", () =>
        prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT p.id
          FROM products p
          WHERE p.is_active = true
            AND p.search_vector @@ plainto_tsquery('english', ${term})
          ORDER BY ts_rank(p.search_vector, plainto_tsquery('english', ${term})) DESC
          LIMIT 50
        `)
      );
      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          ids.push(row.id);
          if (ids.length >= 50) return ids;
        }
      }
    } catch {
      // plainto_tsquery can fail on odd tokens; try next variant
    }
  }
  return ids;
}

async function resolveTrigramSearchIds(rawQ: string, profile: ShopListingProfile): Promise<string[]> {
  const compact = normalizeSearchTerm(rawQ);
  if (compact.length < 3) return [];

  const rows = await profiledQuery(profile, "search.trigram", () =>
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = true
        AND (
          similarity(LOWER(REPLACE(p.name, ' ', '')), ${compact}) > 0.3
          OR similarity(LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')), ${compact}) > 0.3
          OR similarity(LOWER(REPLACE(COALESCE(p.short_description, ''), ' ', '')), ${compact}) > 0.3
        )
      ORDER BY GREATEST(
        similarity(LOWER(REPLACE(p.name, ' ', '')), ${compact}),
        similarity(LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')), ${compact}),
        similarity(LOWER(REPLACE(COALESCE(p.short_description, ''), ' ', '')), ${compact})
      ) DESC
      LIMIT 50
    `)
  );
  return rows.map((r) => r.id);
}

async function resolveSkuSearchIds(term: string, profile: ShopListingProfile): Promise<string[]> {
  const skuRows = await profiledQuery(profile, "search.sku", () =>
    prisma.products.findMany({
      where: {
        is_active: true,
        OR: [
          { sku: { equals: term, mode: "insensitive" } },
          { product_variants: { some: { sku: { equals: term, mode: "insensitive" } } } },
        ],
      },
      select: { id: true },
      take: 200,
    })
  );
  return skuRows.map((r) => r.id);
}

/** Search waterfall — first non-empty result wins (FTS → ILIKE → trigram → SKU). */
export async function resolveSearchProductIds(
  searchTerm: string,
  profile: ShopListingProfile
): Promise<string[]> {
  const rawQ = searchTerm.trim();
  if (!rawQ) return [];

  try {
    const fts = await resolveFtsSearchIds(rawQ, profile);
    if (fts.length > 0) return fts;
  } catch (err) {
    console.error("[shopListing] full-text search failed", err);
  }

  try {
    const normalized = await resolveNormalizedIlikeSearchIds(rawQ, profile);
    if (normalized.length > 0) return normalized;
  } catch (err) {
    console.error("[shopListing] normalized ILIKE search failed", err);
  }

  try {
    const trgm = await resolveTrigramSearchIds(rawQ, profile);
    if (trgm.length > 0) return trgm;
  } catch (err) {
    console.error("[shopListing] trigram search failed", err);
  }

  try {
    return await resolveSkuSearchIds(rawQ, profile);
  } catch (err) {
    console.error("[shopListing] SKU search failed", err);
    return [];
  }
}
