import ProductItem from "@/components/Common/ProductItem";
import LiveShopFilters from "@/components/Shop/LiveShopFilters";
import LcpImagePrelink from "@/components/Common/LcpImagePrelink";
import { getCategories } from "@/get-api-data/category";
import Link from "next/link";
import { getProductCardImageUrl } from "@/lib/shop/productCardImage";
import { SHOP_GRID_CARD_SIZES } from "@/lib/shop/productCardGridSizes";
import { getShopListing } from "@/lib/shop/shopListing";

export const metadata = {
  title: "Shop | i-Robox",
  description: "Browse toys and games at i-Robox.",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pickMulti(sp: Record<string, string | string[] | undefined>, key: string): string[] {
  const raw = sp[key];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((s) => s.trim()).filter(Boolean))];
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function buildListingParams(sp: {
  q: string;
  categorySlugs: string[];
  brands: string[];
  ageGroups: string[];
  diecastScales: string[];
  types: string[];
  subtypes: string[];
  collections: string[];
  discounts: string[];
  minPrice: string;
  maxPrice: string;
  available: string;
  sort: string;
  page: number;
}) {
  const usp = new URLSearchParams();
  if (sp.q) usp.set("q", sp.q);
  for (const c of sp.categorySlugs) usp.append("category", c);
  for (const b of sp.brands) usp.append("brand", b);
  for (const a of sp.ageGroups) usp.append("ageGroup", a);
  for (const d of sp.diecastScales) usp.append("diecastScale", d);
  for (const t of sp.types) usp.append("type", t);
  for (const s of sp.subtypes) usp.append("subtype", s);
  for (const c of sp.collections) usp.append("collection", c);
  for (const d of sp.discounts) usp.append("discount", d);
  if (sp.minPrice) usp.set("minPrice", sp.minPrice);
  if (sp.maxPrice) usp.set("maxPrice", sp.maxPrice);
  if (sp.available) usp.set("available", sp.available);
  if (sp.sort === "price_asc" || sp.sort === "price_desc") usp.set("sort", sp.sort);
  if (sp.page > 1) usp.set("page", String(sp.page));
  return usp;
}

/** Page numbers with ellipses: e.g. 1 2 3 4 … 48 49 50 … 98 99 100 */
function paginationItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return [];
  const clamped = Math.max(1, Math.min(total, current));

  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const add = (set: Set<number>, p: number) => {
    if (p >= 1 && p <= total) set.add(p);
  };
  const set = new Set<number>();
  add(set, 1);
  add(set, 2);
  add(set, 3);
  add(set, 4);
  add(set, total - 2);
  add(set, total - 1);
  add(set, total);
  add(set, clamped - 1);
  add(set, clamped);
  add(set, clamped + 1);

  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

export default async function ShopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = pickString(sp.q).trim();
  const categorySlugs = pickMulti(sp, "category");
  const brands = pickMulti(sp, "brand");
  const ageGroupsSelected = pickMulti(sp, "ageGroup");
  const diecastScalesSelected = pickMulti(sp, "diecastScale");
  const typesSelected = pickMulti(sp, "type");
  const subtypesSelected = pickMulti(sp, "subtype");
  const collectionsSelected = pickMulti(sp, "collection");
  const discountsSelected = pickMulti(sp, "discount");
  const minPrice = pickString(sp.minPrice).trim();
  const maxPrice = pickString(sp.maxPrice).trim();
  const available = pickString(sp.available).trim();
  const sortRaw = pickString(sp.sort).trim();
  const sort =
    sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : "";
  const page = Number(pickString(sp.page) || "1");

  const allCategories = await getCategories();

  const listing = await getShopListing(
    buildListingParams({
      q,
      categorySlugs,
      brands,
      ageGroups: ageGroupsSelected,
      diecastScales: diecastScalesSelected,
      types: typesSelected,
      subtypes: subtypesSelected,
      collections: collectionsSelected,
      discounts: discountsSelected,
      minPrice,
      maxPrice,
      available,
      sort,
      page,
    })
  );
  const productData = listing.ok
    ? listing.data
    : {
        items: [],
        totalPages: 1,
        ageGroups: [],
        diecastScales: [],
        brands: [],
        productTypes: [],
        productSubtypes: [],
        productCollections: [],
        discountBuckets: [],
        page: 1,
        pageSize: 12,
        total: 0,
      };

  const products = productData?.items ?? [];
  const lcpPreloadUrl =
    products.length > 0 ? getProductCardImageUrl(products[0]) : "";
  const totalPages = Math.max(1, productData?.totalPages ?? 1);
  const currentPage = productData?.page ?? page;
  const ageGroups: string[] = Array.isArray(productData?.ageGroups) ? productData.ageGroups : [];
  const diecastScales: string[] = Array.isArray(productData?.diecastScales) ? productData.diecastScales : [];
  const shopBrands: { slug: string; name: string; count: number }[] = Array.isArray(productData?.brands)
    ? productData.brands
    : [];
  const productTypes = Array.isArray(productData?.productTypes) ? productData.productTypes : [];
  const productSubtypes = Array.isArray(productData?.productSubtypes) ? productData.productSubtypes : [];
  const productCollections = Array.isArray(productData?.productCollections) ? productData.productCollections : [];
  const discountBuckets = Array.isArray(productData?.discountBuckets) ? productData.discountBuckets : [];
  const hasCategorySelection = categorySlugs.length > 0;
  const hasTypeSelection = typesSelected.length > 0;
  const selectedCategoryNames = new Set(
    allCategories
      .filter((cat) => categorySlugs.includes(cat.slug))
      .map((cat) => ("name" in cat ? cat.name : cat.title).trim().toLowerCase())
  );
  const showScales = selectedCategoryNames.has("toy cars, trains & vehicles");
  const renderFilters = (formId: string) => (
    <div className="rounded-xl border border-gray-3 bg-white p-5">
      <form id={formId} className="mb-5 space-y-3" action="/shop" method="get">
        <LiveShopFilters formId={formId} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products…"
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="minPrice"
            defaultValue={minPrice}
            placeholder="Min ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <input
            name="maxPrice"
            defaultValue={maxPrice}
            placeholder="Max ₹"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </div>
        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Age groups</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {ageGroups.map((group) => (
              <li key={group}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input type="checkbox" name="ageGroup" value={group} defaultChecked={ageGroupsSelected.includes(group)} />
                  {group}
                </label>
              </li>
            ))}
          </ul>
        </details>

        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Categories</summary>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
            {allCategories.length > 0 ? (
              allCategories.map((cat) => (
                <li key={cat.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-dark-4 hover:text-blue">
                    <input
                      type="checkbox"
                      name="category"
                      value={cat.slug}
                      defaultChecked={categorySlugs.includes(cat.slug)}
                      className="mt-0.5 rounded border-gray-3 text-blue focus:ring-blue"
                    />
                    <span className="leading-snug">
                      {"name" in cat ? (cat as { name: string }).name : (cat as { title: string }).title}
                    </span>
                  </label>
                </li>
              ))
            ) : (
              <li className="text-meta-4 text-sm">No categories yet.</li>
            )}
          </ul>
        </details>

        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Brands</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {shopBrands.map((b) => (
              <li key={b.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input type="checkbox" name="brand" value={b.slug} defaultChecked={brands.includes(b.slug)} />
                  {b.name} ({b.count})
                </label>
              </li>
            ))}
          </ul>
        </details>

        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Product types</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {productTypes.map((t) => (
              <li key={t.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input type="checkbox" name="type" value={t.slug} defaultChecked={typesSelected.includes(t.slug)} />
                  {t.name} ({t.count})
                </label>
              </li>
            ))}
            {!hasCategorySelection ? <li className="text-xs text-meta-4">Select categories to narrow types.</li> : null}
          </ul>
        </details>

        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Subtypes</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {productSubtypes.map((s) => (
              <li key={s.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input type="checkbox" name="subtype" value={s.slug} defaultChecked={subtypesSelected.includes(s.slug)} />
                  {s.name} ({s.count})
                </label>
              </li>
            ))}
            {!hasTypeSelection ? <li className="text-xs text-meta-4">Select type(s) to narrow subtypes.</li> : null}
          </ul>
        </details>

        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Collections</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {productCollections.map((c) => (
              <li key={c.slug}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input
                    type="checkbox"
                    name="collection"
                    value={c.slug}
                    defaultChecked={collectionsSelected.includes(c.slug)}
                  />
                  {c.name} ({c.count})
                </label>
              </li>
            ))}
            {!hasCategorySelection ? <li className="text-xs text-meta-4">Select categories to narrow collections.</li> : null}
          </ul>
        </details>

        <details className="rounded-lg border border-gray-3 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-dark">Discount</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {discountBuckets.map((d) => (
              <li key={d.id}>
                <label className="flex items-center gap-2 text-sm text-dark-4">
                  <input type="checkbox" name="discount" value={d.id} defaultChecked={discountsSelected.includes(d.id)} />
                  {d.label} ({d.count})
                </label>
              </li>
            ))}
          </ul>
        </details>

        {showScales ? (
          <details className="rounded-lg border border-gray-3 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-dark">Scales</summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {diecastScales.map((s) => (
                <li key={s}>
                  <label className="flex items-center gap-2 text-sm text-dark-4">
                    <input
                      type="checkbox"
                      name="diecastScale"
                      value={s}
                      defaultChecked={diecastScalesSelected.includes(s)}
                    />
                    {s}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-meta-3">
          <input type="checkbox" name="available" value="true" defaultChecked={available === "true"} />
          In stock only
        </label>

        <div>
          <label className="mb-1 block text-sm font-semibold text-dark">Sort by</label>
          <select
            name="sort"
            defaultValue={sort}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          >
            <option value="">Newest first</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition"
        >
          Apply
        </button>
        <Link
          href="/shop"
          className="block w-full rounded-lg border border-gray-3 bg-white px-4 py-2 text-center text-sm font-medium text-meta-3 hover:bg-gray-1 hover:text-dark transition"
        >
          Clear filters
        </Link>
      </form>
    </div>
  );

  return (
    <>
      <LcpImagePrelink
        imageUrl={lcpPreloadUrl}
        sizes={SHOP_GRID_CARD_SIZES}
        width={640}
        height={640}
      />
      <section className="overflow-hidden py-10 pb-20">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-64">
            <details className="rounded-xl border border-gray-3 bg-white lg:hidden">
              <summary className="cursor-pointer list-none select-none px-4 py-3 text-sm font-semibold text-dark border-b border-gray-3">
                Filters
              </summary>
              <div className="p-1">{renderFilters("shop-filters-form-mobile")}</div>
            </details>

            <div className="hidden lg:block">{renderFilters("shop-filters-form")}</div>
          </aside>

          <div className="flex-1 min-w-0">
            <h1 className="mb-6 text-2xl font-semibold text-dark">Shop</h1>
            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-7.5 gap-y-9">
                {products.map((item, index) => (
                  <ProductItem
                    item={{
                      id: item.id,
                      title: item.title,
                      price: item.price,
                      discountedPrice: item.discountedPrice,
                      slug: item.slug,
                      quantity: item.quantity,
                      updatedAt: item.updatedAt,
                      reviews: item.reviews,
                      shortDescription: item.shortDescription,
                      ageGroup: item.ageGroup,
                      diecastScale: item.diecastScale,
                      shippingPerUnit: item.shippingPerUnit,
                      productVariants: item.productVariants,
                      product_images: item.product_images,
                      image: item.image,
                    }}
                    key={item.id}
                    cardImageSizes={SHOP_GRID_CARD_SIZES}
                    shopListingImage={
                      index === 0 ? "lcp" : index < 3 ? "eager" : "lazy"
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-meta-3">
                No products available yet. Please check back soon.
              </p>
            )}

            {totalPages > 1 ? (
              <nav
                className="mt-10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
                aria-label="Shop pagination"
              >
                {currentPage > 1 ? (
                  <Link
                    href={`/shop?${buildListingParams({
                      q,
                      categorySlugs,
                      brands,
                      ageGroups: ageGroupsSelected,
                      diecastScales: diecastScalesSelected,
                      types: typesSelected,
                      subtypes: subtypesSelected,
                      collections: collectionsSelected,
                      discounts: discountsSelected,
                      minPrice,
                      maxPrice,
                      available,
                      sort,
                      page: currentPage - 1,
                    }).toString()}`}
                    className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-white grid place-items-center text-sm font-medium text-dark hover:bg-gray-1"
                    aria-label="Previous page"
                  >
                    &lt;
                  </Link>
                ) : (
                  <span
                    className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-gray-1 grid place-items-center text-sm text-meta-4 pointer-events-none"
                    aria-hidden
                  >
                    &lt;
                  </span>
                )}

                {paginationItems(currentPage, totalPages).map((item, i) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${i}`}
                      className="px-1 text-sm text-meta-4 select-none"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      key={item}
                      href={`/shop?${buildListingParams({
                        q,
                        categorySlugs,
                        brands,
                        ageGroups: ageGroupsSelected,
                        diecastScales: diecastScalesSelected,
                        types: typesSelected,
                        subtypes: subtypesSelected,
                        collections: collectionsSelected,
                        discounts: discountsSelected,
                        minPrice,
                        maxPrice,
                        available,
                        sort,
                        page: item,
                      }).toString()}`}
                      className={`h-9 min-w-9 px-2 rounded-lg border grid place-items-center text-sm font-medium ${
                        item === currentPage
                          ? "bg-blue text-white border-blue"
                          : "border-gray-3 bg-white text-blue hover:bg-gray-1"
                      }`}
                      aria-current={item === currentPage ? "page" : undefined}
                    >
                      {item}
                    </Link>
                  )
                )}

                {currentPage < totalPages ? (
                  <Link
                    href={`/shop?${buildListingParams({
                      q,
                      categorySlugs,
                      brands,
                      ageGroups: ageGroupsSelected,
                      diecastScales: diecastScalesSelected,
                      types: typesSelected,
                      subtypes: subtypesSelected,
                      collections: collectionsSelected,
                      discounts: discountsSelected,
                      minPrice,
                      maxPrice,
                      available,
                      sort,
                      page: currentPage + 1,
                    }).toString()}`}
                    className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-white grid place-items-center text-sm font-medium text-dark hover:bg-gray-1"
                    aria-label="Next page"
                  >
                    &gt;
                  </Link>
                ) : (
                  <span
                    className="h-9 min-w-9 px-2 rounded-lg border border-gray-3 bg-gray-1 grid place-items-center text-sm text-meta-4 pointer-events-none"
                    aria-hidden
                  >
                    &gt;
                  </span>
                )}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
