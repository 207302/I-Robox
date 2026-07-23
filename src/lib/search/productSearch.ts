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

/** Letters/digits only — used for alternate compact query terms (e.g. "F 1" → "f1"). */
export function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function wordsOf(value: string): string[] {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

/** Whole-word or whole-word-prefix match (never mid-token substring). */
export function wordOrPrefixMatch(fieldWords: string[], term: string): boolean {
  if (!term) return false;
  return fieldWords.some((w) => w === term || w.startsWith(term));
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

/**
 * Match if every query word is a whole-word/prefix hit on some field word,
 * OR the compacted query (e.g. "F 1" → "f1") is a whole-word/prefix hit.
 * Does not strip spaces from field text before matching — "F-150" → words
 * ["f","150"], so "f1" no longer matches.
 */
export function fuzzyMatchProduct(query: string, item: ProductSearchItem): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const andWords = q.split(" ").filter(Boolean);
  const qCompact = compactSearchText(query);
  // "F 1" splits to ["f","1"] whose join equals compact "f1" — still treat as
  // one code token so we don't AND-match every product that has both "f…" and "1…".
  const compactOnly =
    Boolean(qCompact) &&
    andWords.length > 1 &&
    andWords.every((w) => w.length <= 2) &&
    qCompact.length <= 4;

  const fields = searchableFields(item);

  const matchesTerms = (terms: string[]) => {
    for (const field of fields) {
      const fieldWords = wordsOf(field);
      if (terms.every((t) => wordOrPrefixMatch(fieldWords, t))) return true;
    }
    if (terms.length > 1) {
      const allWords = fields.flatMap((f) => wordsOf(f));
      if (terms.every((t) => wordOrPrefixMatch(allWords, t))) return true;
    }
    return false;
  };

  if (compactOnly) {
    return matchesTerms([qCompact]);
  }

  if (matchesTerms(andWords)) return true;
  if (qCompact && qCompact !== andWords.join("") && matchesTerms([qCompact])) return true;
  return false;
}

/** Higher = better match; used to sort results. */
export function fuzzyMatchScore(query: string, item: ProductSearchItem): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const qCompact = compactSearchText(query);
  const andWords = q.split(" ").filter(Boolean);
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
    const fieldWords = wordsOf(value);
    if (andWords.every((t) => fieldWords.some((w) => w === t))) score += weight * 4;
    else if (andWords.every((t) => wordOrPrefixMatch(fieldWords, t))) score += weight * 3;
    else if (qCompact && wordOrPrefixMatch(fieldWords, qCompact)) score += weight * 2;
  }

  if (andWords.length > 1) {
    const allWords = searchableFields(item).flatMap((f) => wordsOf(f));
    if (andWords.every((t) => wordOrPrefixMatch(allWords, t))) score += 5;
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
