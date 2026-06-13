"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { filterAndSortProducts, type ProductSearchItem } from "@/lib/search/productSearch";

type TaxonomyItem = { id: string; name: string };

type AdminCouponScopeFieldsProps = {
  categories: TaxonomyItem[];
  brands: TaxonomyItem[];
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  onBrandIdsChange: (ids: string[]) => void;
  onProductIdsChange: (ids: string[]) => void;
};

export function AdminCouponScopeFields({
  categories,
  brands,
  categoryIds,
  brandIds,
  productIds,
  onCategoryIdsChange,
  onBrandIdsChange,
  onProductIdsChange,
}: AdminCouponScopeFieldsProps) {
  const selectedCategories = new Set(categoryIds);
  const selectedBrands = new Set(brandIds);
  const selectedProducts = new Set(productIds);

  const [products, setProducts] = useState<ProductSearchItem[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const deferredProductQuery = useDeferredValue(productQuery);

  useEffect(() => {
    void fetch("/api/products/search-index")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) setProducts(data.items);
      })
      .catch(() => {});
  }, []);

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, deferredProductQuery),
    [products, deferredProductQuery]
  );

  const visibleProducts = useMemo(() => {
    const selected = products.filter((p) => selectedProducts.has(p.id));
    const merged = new Map<string, ProductSearchItem>();
    for (const p of selected) merged.set(p.id, p);
    for (const p of filteredProducts.slice(0, 80)) merged.set(p.id, p);
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filteredProducts, selectedProducts]);

  const allCategoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const allBrandIds = useMemo(() => brands.map((b) => b.id), [brands]);
  const allProductIds = useMemo(() => products.map((p) => p.id), [products]);

  const allCategoriesSelected =
    categories.length > 0 && categoryIds.length === categories.length;
  const allBrandsSelected = brands.length > 0 && brandIds.length === brands.length;
  const allProductsSelected = products.length > 0 && productIds.length === products.length;

  function ScopeSelectAllBar({
    selectedCount,
    totalCount,
    allSelected,
    onSelectAll,
    onClear,
  }: {
    selectedCount: number;
    totalCount: number;
    allSelected: boolean;
    onSelectAll: () => void;
    onClear: () => void;
  }) {
    if (totalCount === 0) return null;
    return (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-meta-3">
          {selectedCount} of {totalCount} selected
        </span>
        <div className="flex items-center gap-3 text-xs font-medium">
          <button
            type="button"
            disabled={allSelected}
            onClick={onSelectAll}
            className="text-blue hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Select all
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onClear}
            className="text-meta-3 hover:text-dark hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Clear all
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <span className="mb-2 block text-sm font-medium text-dark">Allowed categories (optional)</span>
        <p className="text-xs text-meta-3 mb-2">
          Discount applies to cart lines in these categories (including all subcategories). Other
          items are unchanged.
        </p>
        <ScopeSelectAllBar
          selectedCount={categoryIds.length}
          totalCount={categories.length}
          allSelected={allCategoriesSelected}
          onSelectAll={() => onCategoryIdsChange(allCategoryIds)}
          onClear={() => onCategoryIdsChange([])}
        />
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-3 p-3 space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-meta-3">No categories found.</p>
          ) : (
            categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategories.has(c.id)}
                  onChange={() => {
                    const next = new Set(categoryIds);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    onCategoryIdsChange([...next]);
                  }}
                />
                {c.name}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-dark">Allowed brands (optional)</span>
        <p className="text-xs text-meta-3 mb-2">
          Discount applies to cart lines from these brands. Other items are unchanged.
        </p>
        <ScopeSelectAllBar
          selectedCount={brandIds.length}
          totalCount={brands.length}
          allSelected={allBrandsSelected}
          onSelectAll={() => onBrandIdsChange(allBrandIds)}
          onClear={() => onBrandIdsChange([])}
        />
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-3 p-3 space-y-2">
          {brands.length === 0 ? (
            <p className="text-sm text-meta-3">No brands found.</p>
          ) : (
            brands.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedBrands.has(b.id)}
                  onChange={() => {
                    const next = new Set(brandIds);
                    if (next.has(b.id)) next.delete(b.id);
                    else next.add(b.id);
                    onBrandIdsChange([...next]);
                  }}
                />
                {b.name}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-dark">Allowed products (optional)</span>
        <p className="text-xs text-meta-3 mb-2">
          Discount applies only to these products. Other items in the cart are unchanged.
        </p>
        <input
          type="search"
          value={productQuery}
          onChange={(e) => setProductQuery(e.target.value)}
          placeholder="Search product name, brand, SKU…"
          className="mb-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <ScopeSelectAllBar
          selectedCount={productIds.length}
          totalCount={products.length}
          allSelected={allProductsSelected}
          onSelectAll={() => onProductIdsChange(allProductIds)}
          onClear={() => onProductIdsChange([])}
        />
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-3 p-3 space-y-2">
          {products.length === 0 ? (
            <p className="text-sm text-meta-3">Loading products…</p>
          ) : visibleProducts.length === 0 ? (
            <p className="text-sm text-meta-3">No products match your search.</p>
          ) : (
            visibleProducts.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedProducts.has(p.id)}
                  onChange={() => {
                    const next = new Set(productIds);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    onProductIdsChange([...next]);
                  }}
                />
                <span>
                  {p.name}
                  {p.brand ? <span className="text-meta-3"> — {p.brand}</span> : null}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
    </>
  );
}
