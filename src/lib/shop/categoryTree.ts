import { unstable_cache } from "next/cache";
import { safeCategoriesFindMany } from "@/lib/db/safeReads";
import { CATEGORIES_TAG, PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG } from "@/lib/cache/tags";
import { onCacheMiss } from "@/lib/observability/cache";

export type CategoryTreeNode = {
  id: string;
  parent_id: string | null;
  slug: string;
};

/** In-memory indexes built once per filter resolution (not per BFS). */
type CategoryTreeIndex = {
  childrenByParent: Map<string | null, string[]>;
  /** slug (lowercase) → nodes sharing that slug */
  bySlugLower: Map<string, CategoryTreeNode[]>;
  tree: CategoryTreeNode[];
};

/** Plural/singular slug variants (matches shopListing). */
export function slugVariants(slug: string): string[] {
  const s = slug.trim();
  const lower = s.toLowerCase();
  const variants = new Set<string>([s, lower]);
  if (!lower.endsWith("s")) variants.add(`${lower}s`);
  if (lower.endsWith("s") && lower.length > 2) variants.add(lower.slice(0, -1));
  return [...variants];
}

export function slugMatchOrClause(slug: string) {
  return slugVariants(slug).map((v) => ({ slug: { equals: v, mode: "insensitive" as const } }));
}

/** One DB read per cache window — shared by all shop listing category filters. */
const loadCategoryTreeRows = unstable_cache(
  onCacheMiss("shop-category-tree", async (): Promise<CategoryTreeNode[]> => {
    try {
      return await safeCategoriesFindMany({
        select: { id: true, parent_id: true, slug: true },
      });
    } catch {
      return [];
    }
  }),
  ["shop-category-tree"],
  { revalidate: 120, tags: [PRODUCT_CATALOG_TAG, SHOP_LISTING_TAG, CATEGORIES_TAG] }
);

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  return loadCategoryTreeRows();
}

function buildChildrenIndex(tree: CategoryTreeNode[]) {
  const childrenByParent = new Map<string | null, string[]>();
  for (const c of tree) {
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
    childrenByParent.get(c.parent_id)!.push(c.id);
  }
  return childrenByParent;
}

function buildTreeIndex(tree: CategoryTreeNode[]): CategoryTreeIndex {
  const childrenByParent = buildChildrenIndex(tree);
  const bySlugLower = new Map<string, CategoryTreeNode[]>();
  for (const c of tree) {
    const key = c.slug.toLowerCase();
    const bucket = bySlugLower.get(key);
    if (bucket) bucket.push(c);
    else bySlugLower.set(key, [c]);
  }
  return { childrenByParent, bySlugLower, tree };
}

/** BFS over pre-built parent→children index (O(subtree), no DB). */
export function descendantCategoryIdsFromIndex(
  rootId: string,
  childrenByParent: Map<string | null, string[]>
): string[] {
  const out = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const kid of childrenByParent.get(id) ?? []) {
      if (!out.has(kid)) {
        out.add(kid);
        queue.push(kid);
      }
    }
  }
  return [...out];
}

/** @deprecated Prefer `descendantCategoryIdsFromIndex` when index is already built. */
export function descendantCategoryIds(rootId: string, tree: CategoryTreeNode[]): string[] {
  return descendantCategoryIdsFromIndex(rootId, buildChildrenIndex(tree));
}

function rootsForSlugFromIndex(slug: string, index: CategoryTreeIndex): CategoryTreeNode[] {
  const seen = new Set<string>();
  const roots: CategoryTreeNode[] = [];
  for (const variant of slugVariants(slug)) {
    for (const node of index.bySlugLower.get(variant.toLowerCase()) ?? []) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        roots.push(node);
      }
    }
  }
  if (roots.length > 0) return roots;

  const firstSegment = slug.split("-").filter(Boolean)[0] ?? "";
  if (firstSegment.length < 3) return [];
  const needle = firstSegment.toLowerCase();
  for (const c of index.tree) {
    if (c.slug.toLowerCase().includes(needle) && !seen.has(c.id)) {
      seen.add(c.id);
      roots.push(c);
      if (roots.length >= 25) break;
    }
  }
  return roots;
}

function collectIdsForSlug(slug: string, index: CategoryTreeIndex, into: Set<string>) {
  const roots = rootsForSlugFromIndex(slug, index);
  for (const r of roots) {
    for (const id of descendantCategoryIdsFromIndex(r.id, index.childrenByParent)) {
      into.add(id);
    }
  }
}

/** Resolve category filter slug → all category ids in subtree (cached tree). */
export async function categoryIdsForFilterSlug(slug: string): Promise<string[] | null> {
  const tree = await loadCategoryTreeRows();
  if (tree.length === 0) return null;
  const index = buildTreeIndex(tree);
  const idSet = new Set<string>();
  collectIdsForSlug(slug, index, idSet);
  return idSet.size > 0 ? [...idSet] : null;
}

/** Resolve multiple category slugs in one tree load + one index build. */
export async function categoryIdsForFilterSlugs(slugs: string[]): Promise<Set<string>> {
  const idSet = new Set<string>();
  if (slugs.length === 0) return idSet;
  const tree = await loadCategoryTreeRows();
  if (tree.length === 0) return idSet;
  const index = buildTreeIndex(tree);
  for (const slug of slugs) {
    collectIdsForSlug(slug, index, idSet);
  }
  return idSet;
}
