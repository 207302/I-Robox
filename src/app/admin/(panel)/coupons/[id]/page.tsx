"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AdminCouponScopeFields } from "@/components/admin/AdminCouponScopeFields";

type TaxonomyItem = { id: string; name: string; slug: string };

type CouponForm = {
  code?: string;
  discount_type?: string;
  discount_value?: string | number;
  min_cart_value?: string | number | null;
  max_uses?: string | number | null;
  max_uses_per_user?: string | number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  category_ids?: string[];
  brand_ids?: string[];
  product_ids?: string[];
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditCouponPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CouponForm | null>(null);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [brands, setBrands] = useState<TaxonomyItem[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/brands").then((r) => r.json()),
    ])
      .then(([catData, brandData]) => {
        if (Array.isArray(catData)) setCategories(catData);
        if (Array.isArray(brandData)) setBrands(brandData);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/coupons/${id}`);
      const data = await res.json().catch(() => null);
      if (!data || data.error) {
        setForm(null);
        return;
      }
      setForm({
        ...data,
        category_ids: Array.isArray(data.category_ids) ? data.category_ids : [],
        brand_ids: Array.isArray(data.brand_ids) ? data.brand_ids : [],
        product_ids: Array.isArray(data.product_ids) ? data.product_ids : [],
        starts_at: toLocalInput(data.starts_at),
        ends_at: toLocalInput(data.ends_at),
      });
    })();
  }, [id]);

  async function save() {
    if (!form) return;
    setLoading(true);
    try {
      const starts_at =
        form.starts_at && String(form.starts_at).trim()
          ? new Date(String(form.starts_at)).toISOString()
          : null;
      const ends_at =
        form.ends_at && String(form.ends_at).trim()
          ? new Date(String(form.ends_at)).toISOString()
          : null;
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          starts_at,
          ends_at,
          category_ids: form.category_ids ?? [],
          brand_ids: form.brand_ids ?? [],
          product_ids: form.product_ids ?? [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");
      toast.success("Saved");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (!form) return <div className="text-sm text-meta-3">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-dark">Edit coupon</h1>
        <button
          disabled={loading}
          onClick={save}
          className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Code</span>
          <input
            value={form.code ?? ""}
            onChange={(e) => setForm((f) => ({ ...f!, code: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Type</span>
            <select
              value={form.discount_type}
              onChange={(e) => setForm((f) => ({ ...f!, discount_type: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              <option value="PERCENTAGE">PERCENTAGE</option>
              <option value="FIXED">FIXED</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Value</span>
            <input
              value={form.discount_value ?? ""}
              onChange={(e) => setForm((f) => ({ ...f!, discount_value: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Min cart value</span>
          <input
            value={form.min_cart_value ?? ""}
            onChange={(e) => setForm((f) => ({ ...f!, min_cart_value: e.target.value }))}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Max uses (total)</span>
            <input
              value={form.max_uses ?? ""}
              onChange={(e) => setForm((f) => ({ ...f!, max_uses: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              placeholder="empty = unlimited"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Max uses per user</span>
            <input
              value={form.max_uses_per_user ?? ""}
              onChange={(e) => setForm((f) => ({ ...f!, max_uses_per_user: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              placeholder="empty = unlimited"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Starts at</span>
            <input
              type="datetime-local"
              value={form.starts_at ?? ""}
              onChange={(e) => setForm((f) => ({ ...f!, starts_at: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Ends at</span>
            <input
              type="datetime-local"
              value={form.ends_at ?? ""}
              onChange={(e) => setForm((f) => ({ ...f!, ends_at: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <AdminCouponScopeFields
          categories={categories}
          brands={brands}
          categoryIds={form.category_ids ?? []}
          brandIds={form.brand_ids ?? []}
          productIds={form.product_ids ?? []}
          onCategoryIdsChange={(category_ids) => setForm((f) => ({ ...f!, category_ids }))}
          onBrandIdsChange={(brand_ids) => setForm((f) => ({ ...f!, brand_ids }))}
          onProductIdsChange={(product_ids) => setForm((f) => ({ ...f!, product_ids }))}
        />

        <label className="flex items-center gap-2 text-sm text-meta-3">
          <input
            type="checkbox"
            checked={Boolean(form.is_active)}
            onChange={(e) => setForm((f) => ({ ...f!, is_active: e.target.checked }))}
          />
          Active
        </label>
      </div>
    </div>
  );
}
