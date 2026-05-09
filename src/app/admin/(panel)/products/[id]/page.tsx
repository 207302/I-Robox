"use client";

import { parseAdminJsonResponse } from "@/lib/admin/parseAdminFetchResponse";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SelectWithCreate from "../../_components/SelectWithCreate";
import ImageGallery, { GalleryImage } from "../../_components/ImageGallery";

const MAX_IMAGE_BYTES = 9 * 1024 * 1024;

interface Option { id: string; name: string }
interface ProductVariant {
  id: string;
  color: string | null;
  name?: string | null;
  sku?: string | null;
  is_default: boolean;
  product_images?: { id: string; url: string; sort_order: number }[];
}

function galleryImagesFromVariantApi(
  rows: ProductVariant["product_images"] | undefined
): GalleryImage[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((pi) => ({
    id: pi.id,
    url: pi.url,
    sort_order: pi.sort_order,
  }));
}

const AGE_GROUPS = [
  "0-2 years", "2-4 years", "4-6 years", "6-8 years",
  "8-10 years", "10-12 years", "12+ years", "All ages",
];
const DIECAST_ONLY_CATEGORY = "toy cars, trains & vehicles";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [variantImages, setVariantImages] = useState<Record<string, GalleryImage[]>>({});
  const [variantImgBusyId, setVariantImgBusyId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [diecastScales, setDiecastScales] = useState<Option[]>([]);
  const [productTypes, setProductTypes] = useState<Option[]>([]);
  const [productSubtypes, setProductSubtypes] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [newVariantColor, setNewVariantColor] = useState("");
  const selectedCategory = categories.find((c) => c.id === form?.category_id);
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
        const [productRes, catRes, brandRes, scaleRes, colRes] = await Promise.all([
          fetch(`/api/admin/products/${id}`),
          fetch("/api/admin/categories"),
          fetch("/api/admin/brands"),
          fetch("/api/admin/diecast-scales"),
          fetch("/api/admin/product-collections"),
        ]);
        const [product, cats, brnds, scales, cols] = await Promise.all([
          readJsonSafe(productRes),
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

        if (product && typeof product === "object" && !("error" in (product as Record<string, unknown>))) {
          setForm(product);
          setImages((product as { product_images?: GalleryImage[] }).product_images ?? []);
          const variants = (product as { product_variants?: ProductVariant[] }).product_variants ?? [];
          const vmap: Record<string, GalleryImage[]> = {};
          for (const v of variants) {
            vmap[v.id] = galleryImagesFromVariantApi(v.product_images);
          }
          setVariantImages(vmap);
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
  }, [id]);

  useEffect(() => {
    const catId = form?.category_id as string | undefined;
    if (!catId) {
      setProductTypes([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/product-types?category_id=${catId}`);
        const data = await res.json();
        if (res.ok) setProductTypes(Array.isArray(data) ? data : []);
        else setProductTypes([]);
      } catch {
        setProductTypes([]);
      }
    })();
  }, [form?.category_id]);

  useEffect(() => {
    const tid = form?.type_id as string | undefined;
    if (!tid) {
      setProductSubtypes([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/product-subtypes?type_id=${tid}`);
        const data = await res.json();
        if (res.ok) setProductSubtypes(Array.isArray(data) ? data : []);
        else setProductSubtypes([]);
      } catch {
        setProductSubtypes([]);
      }
    })();
  }, [form?.type_id]);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          base_price: Number(form.base_price),
          discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
          shipping_per_unit:
            form.shipping_per_unit === "" || form.shipping_per_unit == null
              ? 0
              : Number(form.shipping_per_unit),
          max_order_quantity:
            form.max_order_quantity === "" || form.max_order_quantity == null
              ? 99
              : Number(form.max_order_quantity),
          available_quantity: Number(form.available_quantity),
          low_stock_threshold: Number(form.low_stock_threshold),
          diecast_scale_id: form.diecast_scale_id || null,
          category_id: form.category_id || null,
          type_id: form.type_id || null,
          subtype_id: form.subtype_id || null,
          collection_id: form.collection_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      toast.success("Saved");
      router.push("/admin/products");
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct() {
    const label = String(form?.name ?? "this product");
    const ok = window.confirm(
      `Delete "${label}"? This permanently removes the product only if there are no order/review references.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const parsed = await parseAdminJsonResponse<{ ok?: boolean }>(res);
      if (!parsed.ok) throw new Error(parsed.message || "Failed to delete product");
      toast.success("Product deleted");
      router.push("/admin/products");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddFiles(files: FileList) {
    const fileArr = Array.from(files);
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
          const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
          const uploadParsed = await parseAdminJsonResponse<{ url?: string }>(uploadRes);
          if (!uploadParsed.ok) throw new Error(uploadParsed.message);
          const uploadData = uploadParsed.data;
          if (!uploadData.url) throw new Error("Upload failed: no URL returned");

          const imgRes = await fetch(`/api/admin/products/${id}/images`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: uploadData.url }),
          });
          const imgParsed = await parseAdminJsonResponse(imgRes);
          if (!imgParsed.ok) throw new Error(imgParsed.message);
          const imgData = imgParsed.data as GalleryImage;

          // Replace temp placeholder with saved record (which has the real DB id)
          setImages((prev) =>
            prev.map((img) => (img.id === tempIds[i] ? imgData : img))
          );
          toast.success("Image uploaded");
        } catch (err: any) {
          toast.error(err?.message || "Failed");
          setImages((prev) => prev.filter((img) => img.id !== tempIds[i]));
        }
      })
    );
  }

  async function handleDeleteImage(img: GalleryImage) {
    if (!img.id) return;
    try {
      const res = await fetch(
        `/api/admin/products/${id}/images?imageId=${img.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setImages((prev) => prev.filter((m) => m.id !== img.id));
      toast.success("Image removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove image");
    }
  }

  async function handleReorder(newOrder: GalleryImage[]) {
    setImages(newOrder);
    // Persist to DB — skip items that still have temp IDs (shouldn't happen, but guard)
    const ids = newOrder.map((img) => img.id).filter((imgId): imgId is string => !!imgId && !imgId.startsWith("temp-"));
    if (ids.length === 0) return;
    setImgBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/images`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: ids }),
      });
      if (!res.ok) throw new Error("Failed to save order");
    } catch {
      toast.error("Could not save image order");
    } finally {
      setImgBusy(false);
    }
  }

  async function handleAddVariantFiles(variantId: string, files: FileList) {
    const fileArr = Array.from(files);
    const tempIds = fileArr.map((_, i) => `temp-${Date.now()}-${i}-${Math.random()}`);

    setVariantImages((prev) => ({
      ...prev,
      [variantId]: [
        ...(prev[variantId] ?? []),
        ...tempIds.map((tid) => ({ id: tid, url: "", uploading: true })),
      ],
    }));

    await Promise.allSettled(
      fileArr.map(async (file, i) => {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name}: max 9 MB per image.`);
          setVariantImages((prev) => ({
            ...prev,
            [variantId]: (prev[variantId] ?? []).filter((img) => img.id !== tempIds[i]),
          }));
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        try {
          const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
          const uploadParsed = await parseAdminJsonResponse<{ url?: string }>(uploadRes);
          if (!uploadParsed.ok) throw new Error(uploadParsed.message);
          const uploadData = uploadParsed.data;
          if (!uploadData.url) throw new Error("Upload failed: no URL returned");

          const imgRes = await fetch(`/api/admin/products/${id}/images`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: uploadData.url, product_variant_id: variantId }),
          });
          const imgParsed = await parseAdminJsonResponse(imgRes);
          if (!imgParsed.ok) throw new Error(imgParsed.message);
          const imgData = imgParsed.data as GalleryImage;

          setVariantImages((prev) => ({
            ...prev,
            [variantId]: (prev[variantId] ?? []).map((img) =>
              img.id === tempIds[i] ? imgData : img
            ),
          }));
          toast.success("Image uploaded");
        } catch (err: any) {
          toast.error(err?.message || "Failed");
          setVariantImages((prev) => ({
            ...prev,
            [variantId]: (prev[variantId] ?? []).filter((img) => img.id !== tempIds[i]),
          }));
        }
      })
    );
  }

  async function handleDeleteVariantImage(variantId: string, img: GalleryImage) {
    if (!img.id) return;
    try {
      const res = await fetch(
        `/api/admin/products/${id}/images?imageId=${img.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setVariantImages((prev) => ({
        ...prev,
        [variantId]: (prev[variantId] ?? []).filter((m) => m.id !== img.id),
      }));
      toast.success("Image removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove image");
    }
  }

  async function handleReorderVariantImages(variantId: string, newOrder: GalleryImage[]) {
    setVariantImages((prev) => ({ ...prev, [variantId]: newOrder }));
    const ids = newOrder
      .map((img) => img.id)
      .filter((imgId): imgId is string => !!imgId && !imgId.startsWith("temp-"));
    if (ids.length === 0) return;
    setVariantImgBusyId(variantId);
    try {
      const res = await fetch(`/api/admin/products/${id}/images`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: ids }),
      });
      if (!res.ok) throw new Error("Failed to save order");
    } catch {
      toast.error("Could not save image order");
    } finally {
      setVariantImgBusyId(null);
    }
  }

  async function addVariant() {
    const color = newVariantColor.trim();
    if (!color) {
      toast.error("Enter a color name");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/variants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to add variant");
      const newVar = data as ProductVariant;
      setForm((f: any) => ({
        ...f,
        product_variants: [...((f?.product_variants as ProductVariant[]) ?? []), { ...newVar, product_images: [] }],
      }));
      setVariantImages((prev) => ({ ...prev, [newVar.id]: [] }));
      setNewVariantColor("");
      toast.success("Variant added");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add variant");
    } finally {
      setLoading(false);
    }
  }

  async function removeVariant(variantId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/variants?variantId=${variantId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete variant");
      setForm((f: any) => ({
        ...f,
        product_variants: ((f?.product_variants as ProductVariant[]) ?? []).filter((v) => v.id !== variantId),
      }));
      setVariantImages((prev) => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
      toast.success("Variant removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove variant");
    } finally {
      setLoading(false);
    }
  }

  async function setDefaultVariant(variantId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/variants`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId, is_default: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to set default variant");
      setForm((f: any) => ({
        ...f,
        product_variants: ((f?.product_variants as ProductVariant[]) ?? []).map((v) => ({
          ...v,
          is_default: v.id === variantId,
        })),
      }));
      toast.success("Default variant updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to set default variant");
    } finally {
      setLoading(false);
    }
  }

  if (!form) {
    return <div className="text-sm text-meta-3">Loading…</div>;
  }

  const isLowStock =
    typeof form.available_quantity === "number" &&
    typeof form.low_stock_threshold === "number" &&
    form.available_quantity <= form.low_stock_threshold;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-dark">Edit product</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={deleteProduct}
            disabled={deleting || loading}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={save}
            disabled={loading || deleting}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Low-stock banner */}
      {isLowStock && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          <span className="text-base">⚠️</span>
          <span>
            <b>Low stock:</b> only {form.available_quantity} unit{form.available_quantity !== 1 ? "s" : ""} left (threshold: {form.low_stock_threshold})
          </span>
        </div>
      )}

      {/* Product details */}
      <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-dark">Product details</h2>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Name <span className="text-red-500">*</span></span>
          <input
            value={form.name ?? ""}
            onChange={(e) => {
              const name = e.target.value;
              const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              setForm((f: any) => ({ ...f, name, slug }));
            }}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Base price (₹) <span className="text-red-500">*</span></span>
            <input
              value={form.base_price ?? ""}
              onChange={(e) => setForm((f: any) => ({ ...f, base_price: e.target.value }))}
              inputMode="decimal"
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Discounted price</span>
            <input
              value={form.discounted_price ?? ""}
              onChange={(e) => setForm((f: any) => ({ ...f, discounted_price: e.target.value }))}
              inputMode="decimal"
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <label className="block max-w-md">
          <span className="mb-1 block text-sm font-medium text-dark">Shipping per unit (₹)</span>
          <input
            value={form.shipping_per_unit ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, shipping_per_unit: e.target.value }))}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <span className="mt-1 block text-xs text-meta-4">
            Order shipping includes quantity × this amount per SKU. Leave 0 to use the default flat fee when below
            free shipping.
          </span>
        </label>
        <label className="block max-w-md">
          <span className="mb-1 block text-sm font-medium text-dark">Max order quantity</span>
          <input
            value={form.max_order_quantity ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, max_order_quantity: e.target.value }))}
            inputMode="numeric"
            placeholder="99"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <span className="mt-1 block text-xs text-meta-4">
            Per-product cap per order. Checkout is blocked if quantity exceeds this limit.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">SKU</span>
          <input
            value={form.sku ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, sku: e.target.value }))}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">HSN (GST)</span>
          <input
            value={form.hsn_code ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, hsn_code: e.target.value }))}
            placeholder="e.g. 95030010"
            inputMode="numeric"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <span className="mt-1 block text-xs text-meta-4">
            Digits only (comma-separated if multiple codes on this SKU). Used for Shipmozo / invoicing.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Short description</span>
          <textarea
            value={form.short_description ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, short_description: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Description</span>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
            rows={5}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-meta-3">
          <input
            type="checkbox"
            checked={Boolean(form.is_active)}
            onChange={(e) => setForm((f: any) => ({ ...f, is_active: e.target.checked }))}
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
            value={form.category_id ?? ""}
            onChange={(val) => {
              const picked = categories.find((c) => c.id === val);
              const allowScale = picked?.name?.trim().toLowerCase() === DIECAST_ONLY_CATEGORY;
              setForm((f: any) => ({
                ...f,
                category_id: val,
                type_id: "",
                subtype_id: "",
                diecast_scale_id: allowScale ? f.diecast_scale_id : "",
              }));
            }}
            options={categories}
            onCreated={(opt) => setCategories((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))}
            onDeleted={(id) => {
              setCategories((prev) => prev.filter((x) => x.id !== id));
              setProductTypes([]);
              setProductSubtypes([]);
              setForm((f: any) => ({ ...f, category_id: "", type_id: "", subtype_id: "" }));
            }}
            createEndpoint="/api/admin/categories"
            deleteEndpointBase="/api/admin/categories"
          />

          <SelectWithCreate
            label="Product type"
            value={form.type_id ?? ""}
            onChange={(val) => setForm((f: any) => ({ ...f, type_id: val, subtype_id: "" }))}
            options={productTypes}
            onCreated={(opt) =>
              setProductTypes((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
            }
            onDeleted={(id) => {
              setProductTypes((prev) => prev.filter((x) => x.id !== id));
              setProductSubtypes([]);
              setForm((f: any) => ({ ...f, type_id: "", subtype_id: "" }));
            }}
            createEndpoint="/api/admin/product-types"
            deleteEndpointBase="/api/admin/product-types"
            placeholder={form.category_id ? "— None —" : "Select a category first"}
            createBody={form.category_id ? { category_id: form.category_id } : undefined}
            disableCreate={!form.category_id}
            disableCreateReason="Select a category first"
            disableSelect={!form.category_id}
          />

          <SelectWithCreate
            label="Subtype"
            value={form.subtype_id ?? ""}
            onChange={(val) => setForm((f: any) => ({ ...f, subtype_id: val }))}
            options={productSubtypes}
            onCreated={(opt) =>
              setProductSubtypes((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
            }
            onDeleted={(id) => {
              setProductSubtypes((prev) => prev.filter((x) => x.id !== id));
              setForm((f: any) => ({ ...f, subtype_id: "" }));
            }}
            createEndpoint="/api/admin/product-subtypes"
            deleteEndpointBase="/api/admin/product-subtypes"
            placeholder={form.type_id ? "— None —" : "Select a type first"}
            createBody={form.type_id ? { product_type_id: form.type_id } : undefined}
            disableCreate={!form.type_id}
            disableCreateReason="Select a product type first"
            disableSelect={!form.type_id}
          />

          <SelectWithCreate
            label="Collection"
            value={form.collection_id ?? ""}
            onChange={(val) => setForm((f: any) => ({ ...f, collection_id: val }))}
            options={collections}
            onCreated={(opt) => setCollections((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))}
            onDeleted={(id) => {
              setCollections((prev) => prev.filter((x) => x.id !== id));
              setForm((f: any) => ({ ...f, collection_id: "" }));
            }}
            createEndpoint="/api/admin/product-collections"
            deleteEndpointBase="/api/admin/product-collections"
          />

          <SelectWithCreate
            label="Brand"
            value={form.brand_id ?? ""}
            onChange={(val) => setForm((f: any) => ({ ...f, brand_id: val }))}
            options={brands}
            onCreated={(opt) => setBrands((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))}
            onDeleted={(id) => {
              setBrands((prev) => prev.filter((x) => x.id !== id));
              setForm((f: any) => ({ ...f, brand_id: "" }));
            }}
            createEndpoint="/api/admin/brands"
            deleteEndpointBase="/api/admin/brands"
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Age group</span>
            <select
              value={form.age_group ?? ""}
              onChange={(e) => setForm((f: any) => ({ ...f, age_group: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              <option value="">— None —</option>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          {showDiecastScale ? (
            <SelectWithCreate
              label="Diecast scale"
              value={form.diecast_scale_id ?? ""}
              onChange={(scaleId) => setForm((f: any) => ({ ...f, diecast_scale_id: scaleId }))}
              options={diecastScales}
              onCreated={(opt) =>
                setDiecastScales((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
              }
              createEndpoint="/api/admin/diecast-scales"
              deleteEndpointBase="/api/admin/diecast-scales"
              onDeleted={(id) => {
                setDiecastScales((prev) => prev.filter((x) => x.id !== id));
                setForm((f: any) => ({ ...f, diecast_scale_id: "" }));
              }}
            />
          ) : null}
        </div>
      </section>

      {/* Images */}
      <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-dark">Color variants</h2>
        <p className="text-xs text-meta-4">
          Add extra colors under the same product slug to avoid duplicate-product slug errors.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newVariantColor}
            onChange={(e) => setNewVariantColor(e.target.value)}
            placeholder="Add color (e.g. Yellow)"
            className="w-full sm:max-w-sm rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <button
            type="button"
            onClick={addVariant}
            disabled={loading || deleting}
            className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
          >
            Add color
          </button>
        </div>
        <div className="space-y-2">
          {((form.product_variants as ProductVariant[] | undefined) ?? []).length === 0 ? (
            <p className="text-sm text-meta-4">No variants yet.</p>
          ) : (
            ((form.product_variants as ProductVariant[]) ?? []).map((variant) => {
              const variantLabel = variant.color || variant.name || "Unnamed color";
              return (
                <div
                  key={variant.id}
                  className="space-y-3 rounded-lg border border-gray-2 px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-dark">
                      {variantLabel}
                      {variant.is_default ? " (default)" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {!variant.is_default ? (
                        <button
                          type="button"
                          onClick={() => setDefaultVariant(variant.id)}
                          className="rounded-md border border-gray-3 px-2 py-1 text-xs text-dark hover:bg-gray-1"
                        >
                          Set default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.id)}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-gray-2 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-dark">
                        Images for {variantLabel}
                      </h3>
                      {variantImgBusyId === variant.id ? (
                        <span className="text-xs text-meta-3">Saving order…</span>
                      ) : null}
                    </div>
                    <ImageGallery
                      images={variantImages[variant.id] ?? []}
                      onReorder={(order) => handleReorderVariantImages(variant.id, order)}
                      onDelete={(img) => handleDeleteVariantImage(variant.id, img)}
                      onAddFiles={(files) => handleAddVariantFiles(variant.id, files)}
                      disabled={loading || deleting}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Images */}
      <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-dark">Product images</h2>
          {imgBusy && (
            <span className="text-xs text-meta-3">Saving order…</span>
          )}
        </div>
        <ImageGallery
          images={images}
          onReorder={handleReorder}
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
            <span className="mb-1 block text-sm font-medium text-dark">Available quantity</span>
            <input
              value={form.available_quantity ?? 0}
              onChange={(e) => setForm((f: any) => ({ ...f, available_quantity: Number(e.target.value) }))}
              inputMode="numeric"
              min={0}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Low stock alert threshold</span>
            <input
              value={form.low_stock_threshold ?? 5}
              onChange={(e) => setForm((f: any) => ({ ...f, low_stock_threshold: Number(e.target.value) }))}
              inputMode="numeric"
              min={0}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <span className="mt-1 block text-xs text-meta-4">Alert triggers when stock ≤ this number</span>
          </label>
        </div>
      </section>

      <button
        onClick={save}
        disabled={loading || deleting}
        className="rounded-lg bg-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
