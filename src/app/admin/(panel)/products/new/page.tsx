"use client";

import { slugFromProductName } from "@/utils/slugGenerate";
import { parseAdminJsonResponse } from "@/lib/admin/parseAdminFetchResponse";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import SelectWithCreate from "../../_components/SelectWithCreate";
import ImageGallery, { GalleryImage } from "../../_components/ImageGallery";

/** Match API upload limit — reject early before upload. */
const MAX_IMAGE_BYTES = 9 * 1024 * 1024;

interface Option { id: string; name: string }
interface VariantDraft {
  id: string;
  color: string;
  is_default: boolean;
}

const AGE_GROUPS = [
  "0-2 years", "2-4 years", "4-6 years", "6-8 years",
  "8-10 years", "10-12 years", "12+ years", "All ages",
];
const DIECAST_ONLY_CATEGORY = "toy cars, trains & vehicles";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [diecastScales, setDiecastScales] = useState<Option[]>([]);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    base_price: "",
    discounted_price: "",
    sku: "",
    hsn_code: "",
    description: "",
    short_description: "",
    is_active: true,
    age_group: "",
    diecast_scale_id: "",
    category_id: "",
    subtype_id: "",
    collection_id: "",
    brand_id: "",
    available_quantity: "0",
    low_stock_threshold: "5",
    shipping_per_unit: "0",
    max_order_quantity: "99",
  });
  const [productSubcategories, setProductSubcategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const selectedCategory = categories.find((c) => c.id === form.category_id);
  const showDiecastScale = selectedCategory?.name?.trim().toLowerCase() === DIECAST_ONLY_CATEGORY;

  useEffect(() => {
    const readJsonSafe = async (res: Response) => {
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    (async () => {
      try {
        const [catRes, brandRes, scaleRes, colRes] = await Promise.all([
          fetch("/api/admin/categories"),
          fetch("/api/admin/brands"),
          fetch("/api/admin/diecast-scales"),
          fetch("/api/admin/product-collections"),
        ]);
        const [cats, brnds, scales, cols] = await Promise.all([
          readJsonSafe(catRes),
          readJsonSafe(brandRes),
          readJsonSafe(scaleRes),
          readJsonSafe(colRes),
        ]);
        if (!catRes.ok || !brandRes.ok || !scaleRes.ok || !colRes.ok) {
          const msg =
            (cats as { error?: string } | null)?.error ||
            (brnds as { error?: string } | null)?.error ||
            (scales as { error?: string } | null)?.error ||
            (cols as { error?: string } | null)?.error ||
            "Failed to load lists";
          throw new Error(msg);
        }
        setCategories(Array.isArray(cats) ? cats : []);
        setBrands(Array.isArray(brnds) ? brnds : []);
        setDiecastScales(Array.isArray(scales) ? scales : []);
        setCollections(Array.isArray(cols) ? cols : []);
      } catch (err: unknown) {
        setCategories([]);
        setBrands([]);
        setDiecastScales([]);
        setCollections([]);
        toast.error(err instanceof Error ? err.message : "Failed to load categories/brands/scales");
      }
    })();
  }, []);

  useEffect(() => {
    if (!form.category_id) {
      setProductSubcategories([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/product-subtypes?category_id=${form.category_id}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string })?.error);
        setProductSubcategories(Array.isArray(data) ? data : []);
      } catch {
        setProductSubcategories([]);
      }
    })();
  }, [form.category_id]);

  async function handleAddFiles(files: FileList) {
    const fileArr = Array.from(files);
    // Use stable temp IDs so parallel updates target the right slots
    const tempIds = fileArr.map((_, i) => `temp-${Date.now()}-${i}-${Math.random()}`);

    setImages((prev) => [
      ...prev,
      ...tempIds.map((tid) => ({ id: tid, url: "", uploading: true })),
    ]);

    await Promise.allSettled(
      fileArr.map(async (file, i) => {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name}: max 9 MB per image.`);
          setImages((prev) => prev.filter((img) => img.id !== tempIds[i]));
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
          const parsed = await parseAdminJsonResponse<{ url?: string }>(res);
          if (!parsed.ok) throw new Error(parsed.message);
          const data = parsed.data;
          if (!data.url) throw new Error("Upload failed: no URL returned");
          setImages((prev) =>
            prev.map((img) =>
              img.id === tempIds[i] ? { id: tempIds[i], url: data.url!, uploading: false } : img
            )
          );
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
          setImages((prev) => prev.filter((img) => img.id !== tempIds[i]));
        }
      })
    );
  }

  function handleDeleteImage(_img: GalleryImage, idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (images.some((img: GalleryImage) => img.uploading)) {
      toast.error("Please wait for images to finish uploading");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          base_price: Number(form.base_price),
          discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
          shipping_per_unit: form.shipping_per_unit.trim() === "" ? 0 : Number(form.shipping_per_unit),
          max_order_quantity: form.max_order_quantity.trim() === "" ? 99 : Number(form.max_order_quantity),
          available_quantity: Number(form.available_quantity),
          low_stock_threshold: Number(form.low_stock_threshold),
          category_id: form.category_id || null,
          brand_id: form.brand_id || null,
          subtype_id: form.subtype_id || null,
          collection_id: form.collection_id || null,
          age_group: form.age_group || null,
          diecast_scale_id: form.diecast_scale_id || null,
          variants: variants
            .map((v) => ({ color: v.color.trim(), is_default: v.is_default }))
            .filter((v) => v.color.length > 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create product");

      for (const img of images) {
        if (img.url) {
          await fetch(`/api/admin/products/${data.id}/images`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: img.url }),
          });
        }
      }

      toast.success("Product created");
      router.push(`/admin/products/${data.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-dark">New product</h1>

      <form onSubmit={submit} className="space-y-5">

        {/* Basic details */}
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-dark">Product details</h2>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Name <span className="text-red-500">*</span></span>
            <input
              required
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: slugFromProductName(name) }));
              }}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-dark">Base price (₹) <span className="text-red-500">*</span></span>
              <input
                required
                value={form.base_price}
                onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
                inputMode="decimal"
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-dark">Discounted price (optional)</span>
              <input
                value={form.discounted_price}
                onChange={(e) => setForm((f) => ({ ...f, discounted_price: e.target.value }))}
                inputMode="decimal"
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-dark">Shipping per unit (₹)</span>
              <input
                value={form.shipping_per_unit}
                onChange={(e) => setForm((f) => ({ ...f, shipping_per_unit: e.target.value }))}
                inputMode="decimal"
                placeholder="0"
                className="w-full max-w-xs rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <span className="mt-1 block text-xs text-meta-4">
                Added to order shipping as (quantity × this rate). Use 0 for each unit to use the default flat fee
                (₹99) when the cart is below the free-shipping threshold.
              </span>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-dark">Max order quantity</span>
              <input
                value={form.max_order_quantity}
                onChange={(e) => setForm((f) => ({ ...f, max_order_quantity: e.target.value }))}
                inputMode="numeric"
                placeholder="99"
                className="w-full max-w-xs rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <span className="mt-1 block text-xs text-meta-4">
                Per-product cap per order. Checkout is blocked if quantity exceeds this limit.
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">SKU (optional)</span>
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">HSN (optional)</span>
            <input
              value={form.hsn_code}
              onChange={(e) => setForm((f) => ({ ...f, hsn_code: e.target.value }))}
              placeholder="e.g. 95030010"
              inputMode="numeric"
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <span className="mt-1 block text-xs text-meta-4">
              Digits (comma-separated if needed). Sent to Shipmozo / GST when shipping this product.
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Short description</span>
            <textarea
              value={form.short_description}
              onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={5}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-meta-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active (visible in store)
          </label>
        </section>

        {/* Classification */}
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-dark">Classification</h2>
          <p className="text-xs text-meta-4">Used for filtering products by category, brand and age on the storefront.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectWithCreate
              label="Category"
              value={form.category_id}
              onChange={(id) => {
                const picked = categories.find((c) => c.id === id);
                const allowScale = picked?.name?.trim().toLowerCase() === DIECAST_ONLY_CATEGORY;
                setForm((f) => ({
                  ...f,
                  category_id: id,
                  subtype_id: "",
                  diecast_scale_id: allowScale ? f.diecast_scale_id : "",
                }));
              }}
              options={categories}
              onCreated={(opt) => setCategories((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))}
              onUpdated={(opt) =>
                setCategories((prev) =>
                  prev.map((x) => (x.id === opt.id ? opt : x)).sort((a, b) => a.name.localeCompare(b.name))
                )
              }
              onDeleted={(id) => {
                setCategories((prev) => prev.filter((x) => x.id !== id));
                setProductSubcategories([]);
                setForm((f) => ({ ...f, category_id: "", subtype_id: "" }));
              }}
              createEndpoint="/api/admin/categories"
              deleteEndpointBase="/api/admin/categories"
            />

            <SelectWithCreate
              label="Sub category"
              value={form.subtype_id}
              onChange={(id) => setForm((f) => ({ ...f, subtype_id: id }))}
              options={productSubcategories}
              onCreated={(opt) =>
                setProductSubcategories((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
              }
              onUpdated={(opt) =>
                setProductSubcategories((prev) =>
                  prev.map((x) => (x.id === opt.id ? opt : x)).sort((a, b) => a.name.localeCompare(b.name))
                )
              }
              onDeleted={(id) => {
                setProductSubcategories((prev) => prev.filter((x) => x.id !== id));
                setForm((f) => ({ ...f, subtype_id: "" }));
              }}
              createEndpoint="/api/admin/product-subtypes"
              deleteEndpointBase="/api/admin/product-subtypes"
              placeholder={form.category_id ? "— None —" : "Select a category first"}
              createBody={form.category_id ? { category_id: form.category_id } : undefined}
              disableCreate={!form.category_id}
              disableCreateReason="Select a category first"
              disableSelect={!form.category_id}
            />

            <SelectWithCreate
              label="Collection"
              value={form.collection_id}
              onChange={(id) => setForm((f) => ({ ...f, collection_id: id }))}
              options={collections}
              onCreated={(opt) => setCollections((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))}
              onUpdated={(opt) =>
                setCollections((prev) =>
                  prev.map((x) => (x.id === opt.id ? opt : x)).sort((a, b) => a.name.localeCompare(b.name))
                )
              }
              onDeleted={(id) => {
                setCollections((prev) => prev.filter((x) => x.id !== id));
                setForm((f) => ({ ...f, collection_id: "" }));
              }}
              createEndpoint="/api/admin/product-collections"
              deleteEndpointBase="/api/admin/product-collections"
            />

            <SelectWithCreate
              label="Brand"
              value={form.brand_id}
              onChange={(id) => setForm((f) => ({ ...f, brand_id: id }))}
              options={brands}
              onCreated={(opt) => setBrands((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))}
              onUpdated={(opt) =>
                setBrands((prev) =>
                  prev.map((x) => (x.id === opt.id ? opt : x)).sort((a, b) => a.name.localeCompare(b.name))
                )
              }
              onDeleted={(id) => {
                setBrands((prev) => prev.filter((x) => x.id !== id));
                setForm((f) => ({ ...f, brand_id: "" }));
              }}
              createEndpoint="/api/admin/brands"
              deleteEndpointBase="/api/admin/brands"
            />

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-dark">Age group</span>
              <select
                value={form.age_group}
                onChange={(e) => setForm((f) => ({ ...f, age_group: e.target.value }))}
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              >
                <option value="">— None —</option>
                {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>

            {showDiecastScale ? (
              <SelectWithCreate
                label="Diecast scale"
                value={form.diecast_scale_id}
                onChange={(id) => setForm((f) => ({ ...f, diecast_scale_id: id }))}
                options={diecastScales}
                onCreated={(opt) =>
                  setDiecastScales((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
                }
                onUpdated={(opt) =>
                  setDiecastScales((prev) =>
                    prev.map((x) => (x.id === opt.id ? opt : x)).sort((a, b) => a.name.localeCompare(b.name))
                  )
                }
                onDeleted={(id) => {
                  setDiecastScales((prev) => prev.filter((x) => x.id !== id));
                  setForm((f) => ({ ...f, diecast_scale_id: "" }));
                }}
                createEndpoint="/api/admin/diecast-scales"
                deleteEndpointBase="/api/admin/diecast-scales"
              />
            ) : null}
          </div>
        </section>

        {/* Images */}
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-dark">Color variants (optional)</h2>
              <p className="text-xs text-meta-4">
                Keep one product (single slug) and add color options like Purple, Yellow, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  { id: `v-${Date.now()}-${Math.random()}`, color: "", is_default: prev.length === 0 },
                ])
              }
              className="rounded-lg border border-gray-3 px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-1"
            >
              Add color
            </button>
          </div>
          {variants.length === 0 ? (
            <p className="text-sm text-meta-4">No variants yet. Product will use base details only.</p>
          ) : (
            <div className="space-y-3">
              {variants.map((variant, idx) => (
                <div key={variant.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 rounded-lg border border-gray-2 p-3">
                  <input
                    value={variant.color}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((v) => (v.id === variant.id ? { ...v, color: e.target.value } : v))
                      )
                    }
                    placeholder={`Color #${idx + 1} (e.g. Purple)`}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-meta-3">
                    <input
                      type="radio"
                      name="default-variant-new"
                      checked={variant.is_default}
                      onChange={() =>
                        setVariants((prev) =>
                          prev.map((v) => ({ ...v, is_default: v.id === variant.id }))
                        )
                      }
                    />
                    Default
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((prev) => {
                        const next = prev.filter((v) => v.id !== variant.id);
                        if (variant.is_default && next.length > 0 && !next.some((v) => v.is_default)) {
                          next[0] = { ...next[0], is_default: true };
                        }
                        return next;
                      })
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Images */}
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-dark">Product images</h2>
          <ImageGallery
            images={images}
            onReorder={setImages}
            onDelete={handleDeleteImage}
            onAddFiles={handleAddFiles}
            disabled={loading}
          />
        </section>

        {/* Stock */}
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-dark">Stock</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-dark">Initial quantity</span>
              <input
                value={form.available_quantity}
                onChange={(e) => setForm((f) => ({ ...f, available_quantity: e.target.value }))}
                inputMode="numeric" min={0}
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-dark">Low stock alert threshold</span>
              <input
                value={form.low_stock_threshold}
                onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                inputMode="numeric" min={0}
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <span className="mt-1 block text-xs text-meta-4">Alert triggers when stock ≤ this number</span>
            </label>
          </div>
        </section>

        <button
          disabled={loading}
          className="rounded-lg bg-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create product"}
        </button>
      </form>
    </div>
  );
}
