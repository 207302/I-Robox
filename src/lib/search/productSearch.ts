export type ProductSearchItem = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  productType: string | null;
  collection: string | null;
  scale: string | null;
  imageUrl?: string | null;
};

/** Lowercase, collapse punctuation to spaces. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters/digits only — matches "hot wheels" to "hotwheels". */
export function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function searchableFields(item: ProductSearchItem): string[] {
  return [
    item.name,
    item.slug,
    item.sku ?? "",
    item.brand ?? "",
    item.category ?? "",
    item.subcategory ?? "",
    item.productType ?? "",
    item.collection ?? "",
    item.scale ?? "",
  ].filter(Boolean);
}

function fieldHaystack(fields: string[]): { spaced: string; compact: string } {
  const joined = fields.join(" ");
  return { spaced: normalizeSearchText(joined), compact: compactSearchText(joined) };
}

/** Lightweight fuzzy match: substring, compact match, or all query tokens present. */
export function fuzzyMatchProduct(query: string, item: ProductSearchItem): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const qCompact = compactSearchText(query);
  const tokens = q.split(" ").filter(Boolean);

  const fields = searchableFields(item);
  for (const field of fields) {
    const n = normalizeSearchText(field);
    const c = compactSearchText(field);
    if (n.includes(q) || c.includes(qCompact)) return true;
    if (tokens.length > 1 && tokens.every((t) => n.includes(t) || c.includes(compactSearchText(t)))) {
      return true;
    }
    if (qCompact.length >= 4 && subsequenceMatch(c, qCompact)) return true;
  }

  if (tokens.length > 1) {
    const { spaced, compact } = fieldHaystack(fields);
    if (tokens.every((t) => spaced.includes(t) || compact.includes(compactSearchText(t)))) {
      return true;
    }
  }

  return false;
}

function subsequenceMatch(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return false;
}

/** Higher = better match; used to sort results. */
export function fuzzyMatchScore(query: string, item: ProductSearchItem): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const qCompact = compactSearchText(query);
  let score = 0;

  const weighted: { value: string | null; weight: number }[] = [
    { value: item.name, weight: 12 },
    { value: item.brand, weight: 10 },
    { value: item.sku, weight: 9 },
    { value: item.category, weight: 7 },
    { value: item.subcategory, weight: 7 },
    { value: item.productType, weight: 6 },
    { value: item.slug, weight: 5 },
    { value: item.collection, weight: 4 },
    { value: item.scale, weight: 3 },
  ];

  for (const { value, weight } of weighted) {
    if (!value) continue;
    const n = normalizeSearchText(value);
    const c = compactSearchText(value);
    if (n === q || c === qCompact) score += weight * 4;
    else if (n.startsWith(q) || c.startsWith(qCompact)) score += weight * 3;
    else if (n.includes(q) || c.includes(qCompact)) score += weight * 2;
    else if (qCompact.length >= 3 && subsequenceMatch(c, qCompact)) score += weight;
  }

  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const { spaced, compact } = fieldHaystack(searchableFields(item));
    if (tokens.every((t) => spaced.includes(t) || compact.includes(compactSearchText(t)))) {
      score += 5;
    }
  }

  return score;
}

export function filterAndSortProducts(items: ProductSearchItem[], query: string): ProductSearchItem[] {
  const q = query.trim();
  if (!q) return items;

  return items
    .filter((item) => fuzzyMatchProduct(q, item))
    .sort((a, b) => fuzzyMatchScore(q, b) - fuzzyMatchScore(q, a));
}
