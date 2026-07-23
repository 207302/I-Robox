import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { profiledQuery, type ShopListingProfile } from "@/lib/shop/shopListingProfile";

function normalizeSearchTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const noSpaces = trimmed.replace(/\s+/g, "");
  const withSpaces = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");
  const spaced = noSpaces.replace(/([a-z]{2,})([a-z])/g, (_, a, b) => `${a} ${b}`);

  return [...new Set([trimmed, noSpaces, withSpaces, spaced])].filter(Boolean);
}

/** Punctuation-split words from a query (no space-stripping of the field itself). */
function queryWords(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Whole-word or whole-word-prefix regex for Postgres ~*.
 * "f1" matches token "f1" or "f1team", but not "xf1" or mid-token "of1970".
 * "F-150" tokenizes as f + 150, so "f1" does not match.
 */
function wordPrefixRegex(term: string): string {
  const t = escapeRegex(term.toLowerCase());
  return `(^|[^a-z0-9])${t}[a-z0-9]*($|[^a-z0-9])`;
}

async function resolveFtsSearchIds(rawQ: string, profile: ShopListingProfile): Promise<string[]> {
  const compact = normalizeSearchTerm(rawQ);
  // Short alphanumeric queries ("F1", "F 1"): only search the compact token.
  // plainto_tsquery('F 1') → 'f' & '1', which falsely matches "F-150".
  const variants =
    compact.length > 0 && compact.length <= 3
      ? [compact]
      : getSearchVariants(rawQ).filter((v) => /[a-z0-9]/i.test(v));
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
          LIMIT 500
        `)
      );
      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          ids.push(row.id);
          if (ids.length >= 200) return ids;
        }
      }
    } catch {
      // plainto_tsquery can fail on odd tokens; try next variant
    }
  }
  return ids;
}

/**
 * Word-boundary / whole-word-prefix match on name, brand, category, SKU only.
 * Never searches description (too noisy — "of 1970s" → false "f1").
 * Short queries (compact ≤3) use the same field list; no looser path.
 */
async function resolveWordBoundarySearchIds(
  rawQ: string,
  profile: ShopListingProfile
): Promise<string[]> {
  const words = queryWords(rawQ);
  const compact = normalizeSearchTerm(rawQ);
  if (words.length === 0 && !compact) return [];

  // Match paths: (all query words AND) OR (compact as a single term, e.g. "F 1" → f1).
  // For short compact codes, skip AND of tiny tokens ("f" & "1") — too loose.
  const compactOnly =
    Boolean(compact) &&
    words.length > 1 &&
    words.every((w) => w.length <= 2) &&
    compact.length <= 4;

  const termSets: string[][] = [];
  if (compactOnly) {
    termSets.push([compact]);
  } else {
    if (words.length > 0) termSets.push(words);
    if (compact && compact !== words.join("")) termSets.push([compact]);
    if (termSets.length === 0 && compact) termSets.push([compact]);
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const terms of termSets) {
    const andClauses = terms.map((term) => {
      const pattern = wordPrefixRegex(term);
      return Prisma.sql`(
        LOWER(COALESCE(p.name, '')) ~* ${pattern}
        OR LOWER(COALESCE(b.name, '')) ~* ${pattern}
        OR LOWER(COALESCE(c.name, '')) ~* ${pattern}
        OR LOWER(COALESCE(p.sku, '')) ~* ${pattern}
        OR LOWER(COALESCE(pv.sku, '')) ~* ${pattern}
      )`;
    });

    const whereAnd =
      andClauses.length === 1 ? andClauses[0]! : Prisma.sql`(${Prisma.join(andClauses, " AND ")})`;

    const rows = await profiledQuery(profile, "search.wordBoundary", () =>
      prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT DISTINCT p.id
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        WHERE p.is_active = true
          AND ${whereAnd}
        LIMIT 500
      `)
    );

    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        ids.push(row.id);
        if (ids.length >= 200) return ids;
      }
    }
  }

  return ids;
}

async function resolveTrigramSearchIds(rawQ: string, profile: ShopListingProfile): Promise<string[]> {
  const compact = normalizeSearchTerm(rawQ);
  // Typo safety net only for longer queries; short queries stay word-boundary only.
  if (compact.length < 4) return [];

  // word_similarity matches a typo against a single word inside the name
  // (e.g. "farrari" ↔ "Ferrari F1 Racing…"); plain similarity on the whole
  // compacted name is too diluted for short typos.
  const rows = await profiledQuery(profile, "search.trigram", () =>
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = true
        AND (
          word_similarity(${compact}, LOWER(p.name)) > 0.4
          OR similarity(LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')), ${compact}) > 0.3
          OR word_similarity(${compact}, LOWER(COALESCE(p.short_description, ''))) > 0.4
        )
      ORDER BY GREATEST(
        word_similarity(${compact}, LOWER(p.name)),
        similarity(LOWER(REPLACE(COALESCE(b.name, ''), ' ', '')), ${compact}),
        word_similarity(${compact}, LOWER(COALESCE(p.short_description, '')))
      ) DESC
      LIMIT 500
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

/**
 * Search waterfall — first non-empty result wins:
 * FTS → word-boundary (name/brand/category/SKU) → trigram (≥4 chars) → exact SKU.
 * Returned IDs are in relevance order and must be preserved by the listing layer.
 */
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
    const wordBoundary = await resolveWordBoundarySearchIds(rawQ, profile);
    if (wordBoundary.length > 0) return wordBoundary;
  } catch (err) {
    console.error("[shopListing] word-boundary search failed", err);
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
